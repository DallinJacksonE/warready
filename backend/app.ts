import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Repository, StoredSession, Entry } from './repository.js';
import { randomUUID } from 'node:crypto';
import { resolve, extname } from 'node:path';
import { profileSchema, journalSchema, eventSchema } from './validation.js';
import { hashToken, opaqueToken, verifyPassword } from './security.js';
export interface AppOptions { repository: Repository; staticDirectory?:string; appOrigin?: string; cookieSecure?: boolean; now?:()=>number; sessionTtlMs?:number; loginLimit?:number }
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
/** Build an isolated application; no implicit connections or listening side effects. */
export function createApp({ repository, staticDirectory=resolve(process.cwd(),'web-dist'), appOrigin='http://localhost:3000', cookieSecure=false, now=Date.now, sessionTtlMs=7*24*60*60*1000, loginLimit=10 }: AppOptions) {
  if(new URL(appOrigin).origin!==appOrigin) throw new Error('APP_ORIGIN must be an exact origin without a trailing slash');
  const app = express(); app.disable('x-powered-by'); app.use(helmet()); app.use(cookieParser());
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.use(express.json({limit:'512kb'}));
  const cookieOptions={httpOnly:true,sameSite:'lax' as const,secure:cookieSecure,path:'/'};
  const originGuard=(req:Request,_res:Response,next:NextFunction)=>{
    if((req.get('Origin') && req.get('Origin')!==appOrigin) || req.get('Sec-Fetch-Site')==='cross-site') return next(new HttpError(403,'Untrusted origin'));
    next();
  };
  const jsonGuard=(req:Request,_res:Response,next:NextFunction)=>{if(!req.is('application/json'))return next(new HttpError(415,'JSON content type required'));next();};
  const resolveSession=async(req:Request):Promise<StoredSession|null>=>{
    const token=req.cookies?.warready_session;
    if(typeof token!=='string'||token.length>256)return null;
    const hash=hashToken(token),session=await repository.getSession(hash);
    if(session && session.expiresAt<=now()){await repository.deleteSession(hash);return null;}
    return session;
  };
  const auth=async(req:Request,res:Response,next:NextFunction)=>{
    const session=await resolveSession(req);
    if(!session || !await repository.getUser(session.userId))throw new HttpError(401,'Authentication required');
    if(req.get('x-csrf-token')!==session.csrfToken)throw new HttpError(403,'Invalid CSRF token');
    res.locals.session=session; next();
  };
  app.get('/api/health',async(_req,res)=>{try{await repository.health();res.json({status:'ok'});}catch{throw new HttpError(503,'Database unavailable');}});
  app.get('/api/bootstrap',async(_req,res)=>{res.json(await repository.bootstrap());});
  app.get('/api/session',async(req,res)=>{const session=await resolveSession(req);const user=session?await repository.getUser(session.userId):null;res.json({user,csrfToken:user?session!.csrfToken:''});});
  app.post('/api/login',originGuard,jsonGuard,rateLimit({windowMs:15*60*1000,limit:loginLimit,standardHeaders:true,legacyHeaders:false,handler:(_req,res)=>{res.status(429).json({error:'Too many login attempts; try again later'});}}),async(req,res)=>{
    const input=z.object({username:z.string().trim().min(1).max(64),password:z.string().min(1).max(256)}).strict().parse(req.body);
    const account=await repository.findAccount(input.username.toLowerCase());
    // Unknown accounts still perform scrypt to reduce username timing disclosure.
    const dummy='scrypt$00000000000000000000000000000000$'+'00'.repeat(64);
    const valid=await verifyPassword(input.password,account?.passwordHash??dummy);
    if(!account||!valid)throw new HttpError(401,'Invalid username or password');
    const prior=await resolveSession(req); if(prior)await repository.deleteSession(prior.tokenHash);
    const token=opaqueToken(),csrfToken=opaqueToken();
    await repository.saveSession({tokenHash:hashToken(token),csrfToken,userId:account.id,expiresAt:now()+sessionTtlMs});
    res.cookie('warready_session',token,{...cookieOptions,maxAge:sessionTtlMs,expires:new Date(now()+sessionTtlMs)});
    res.json({user:await repository.getUser(account.id),csrfToken});
  });
  app.post('/api/logout',originGuard,auth,async(_req,res)=>{await repository.deleteSession((res.locals.session as StoredSession).tokenHash);res.cookie('warready_session','',{...cookieOptions,maxAge:0});res.sendStatus(204);});
  app.put('/api/profile',originGuard,auth,jsonGuard,async(req,res)=>{
    const user=await repository.updateProfile((res.locals.session as StoredSession).userId,profileSchema.parse(req.body));
    if(!user)throw new HttpError(404,'User not found');res.json(user);
  });
  for(const collection of ['journals','events'] as const){
    const schema=collection==='journals'?journalSchema:eventSchema;
    app.post(`/api/${collection}`,originGuard,auth,jsonGuard,async(req,res)=>{
      const input=schema.parse(req.body),timestamp=new Date(now()).toISOString();
      const entry={...input,id:randomUUID(),userId:(res.locals.session as StoredSession).userId,createdAt:timestamp,updatedAt:timestamp} as Entry;
      await repository.createEntry(collection,entry);res.status(201).json(entry);
    });
    app.put(`/api/${collection}/:id`,originGuard,auth,jsonGuard,async(req,res)=>{
      const input=schema.parse(req.body),owner=(res.locals.session as StoredSession).userId;
      const existing=(await repository.bootstrap())[collection].find(entry=>entry.id===req.params.id&&entry.userId===owner);
      if(!existing)throw new HttpError(404,'Entry not found');
      const entry={...existing,...input,updatedAt:new Date(now()).toISOString()} as Entry;
      if(!await repository.updateEntry(collection,entry,owner))throw new HttpError(404,'Entry not found');res.json(entry);
    });
    app.delete(`/api/${collection}/:id`,originGuard,auth,async(req,res)=>{
      if(!await repository.deleteEntry(collection,String(req.params.id),(res.locals.session as StoredSession).userId))throw new HttpError(404,'Entry not found');res.sendStatus(204);
    });
  }
  app.use('/api',(_req,res)=>{res.status(404).json({error:'Not found'});});
  app.use(express.static(staticDirectory,{index:false,dotfiles:'deny'}));
  app.get('/{*path}',(req,res,next)=>{
    if(extname(req.path))return res.status(404).json({error:'Not found'});
    res.sendFile(resolve(staticDirectory,'index.html'),error=>{if(error)next(new HttpError(404,'Not found'));});
  });
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof z.ZodError){res.status(400).json({error:'Invalid request data'});return;}
    if(error instanceof HttpError){res.status(error.status).json({error:error.message});return;}
    const status=(error as {status?:number})?.status;
    res.status(status===400?400:status===413?413:500).json({error:status===400?'Invalid JSON':status===413?'Request too large':'Internal server error'});
  });
  return app;
}
