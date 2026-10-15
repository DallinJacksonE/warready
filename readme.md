# War Ready

A blog/progress tracker for my brother and I to use for our progress in maxxing out the marine fitness test and getting to the 1000 pound club by October 16th, 2027.

## Stack

- MySQL Container: Where our progress and journal entries are stored.
- Express: Simple Typescript CRUD service in a docker container.
- Frontend: React Typescript

## Frontend Features

- Login page for myself and my brother as admins. Each user gets a journal page where they can type out what they did that day. And they get a plan where they can plan milestones and workouts on a calendar. Each user has a user page wtih two progress bars, a green one for marine fitness test and a blue one for the progress towards 1000 lbs on their max weight for the three reps.

- Home page lists the journals of the two admins and allows people to read through them.
- calendar with the admins events (workouts, milestones)

- Journal writer should allow the users to upload text. Optional fields list the requirements and the user can input new max values.

- Lookback features allow for metrics and seeing how progress has improved with a timeline.
