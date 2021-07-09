# Elevatormap Rewritten
The elevator map at thegreydiamond.de/elevatormap has been offline for some time now, as it was very ineffective and didn't accept user contributions. This is an attempted by the original author to rewrite the project in Node.js.

## Host your own
Requirements:
- Node
- MySQL Server (MariaDB)
- Accounts for Fontawesome & hCaptcha

Setup steps:
1. Setup DB access
2. Change config file to your needs
3. Install dependencies with `npm install`
4. Make .js file with `npm run makeJS` (skip if you want to test it)
5. Start it with `npm start` (or use pm2)
It will autogenerate all tables needed. And then startup.

ToDo:
- [ ] Allow user edits
- [ ] Allow moderation
