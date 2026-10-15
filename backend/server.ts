import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { MySqlRepository, mysqlConfig } from './adapters/mysql.js';
import { seedAccounts } from './security.js';
/** Native development stays local; Compose explicitly opts into its container interface. */
export function listenConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return { port, host: env.HOST ?? '127.0.0.1' };
}

/** Initialize persistent schema/accounts before opening the port; fail closed on errors. */
export async function startServer(env:NodeJS.ProcessEnv=process.env){
  const { port, host } = listenConfig(env);
  const repository=new MySqlRepository(mysqlConfig(env));
  try{
    await repository.initialize();
    await seedAccounts(repository,env);
    const app=createApp({repository,appOrigin:env.APP_ORIGIN??'http://localhost:3000',cookieSecure:env.COOKIE_SECURE==='true'});
    const server=app.listen(port,host,()=>console.info(`War Ready listening at http://${host}:${port}`));
    server.on('error',error=>{console.error('HTTP server failed:',error.message);void repository.close();process.exitCode=1;});
    const shutdown=()=>{server.close(()=>{void repository.close().then(()=>process.exit(0));});};
    process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
    return {app,server,repository};
  }catch(error){await repository.close();throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  startServer().catch(error=>{console.error('Startup failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1;});
}
