import * as dotenv from 'dotenv'
import Discord from 'discord.js'
import {Low, JSONFile} from 'lowdb'
import { join , dirname } from 'path'
import { fileURLToPath } from 'url'

// config environment
dotenv.config()
const client = new Discord.Client()
const __dirname = dirname(fileURLToPath(import.meta.url))
const file = join(__dirname, 'db.json')
const adapter = new JSONFile(file)
const db = new Low(adapter)
await db.read()

// connect beep beep boop
await client.login(process.env.DISCORD_TOKEN.trim())

const updateMessage = user => `Updated user ${user}`
const userNotFoundMessage = username => `Could not find user ${username}` //dont mention user again
const userFoundMessage = user => `Found user ${user}` //when searching by ign mention the user
const ignNotFoundMessage = ign => `Could not find a user with ign ${ign}`
const missingText = missing => `There ${missing.length == 1 ? "is":"are"} ${missing.length} account${missing.length > 1 || missing.length == 0 ? "s":""} missing${missing.length == 0 ? "." : ":\n"}${missing}`
const unauthorizedMessage = 'This is an admin only feature.'
const tooManyMentionsMessage = 'You can only update 1 user at a time.'
const errorMessage=`Whoops something went wrong :( <@${process.env.ADMIN_ID}> you dumbo please fix me.`

var msg

const createEmbed = (username,userdb) => {
    let msg = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle("IGN's for " + username)
	userdb.accounts.forEach(account => msg.addField(account.title, account.name))
	return msg
}

// function to handle a new message to the bot
const handleNewMessage = async message => {
	const mentions = [...(message.mentions.members.filter(member => !member.user.bot))]

	if(message.content.startsWith('!whois')) {
		console.log("!whois in " + message.channel.name)
		handleWhoIs(message, mentions)
	} else if(message.content.startsWith('!setign')){
		console.log("!setign in " + message.channel.name)
		setIgn(message, mentions)
	} else if(message.content.startsWith('!addign')) {
		console.log("!addign in " + message.channel.name)
		addIgn(message, mentions)
	} else if(message.content.startsWith('!ignmissing')) {
		console.log("!ignmissing in " + message.channel.name)
		ignMissing(message)
	}
}

const handleWhoIs = (message, mentions) => {
	if (mentions.length === 0) {
		const msg = message.content.substring(7)
		const users = findByIgn(msg)
		if(users.length > 0) {
			users.forEach(async user => {
				message.guild.members.fetch(user.id)
					.then(discorduser => {
						message.channel.send(userFoundMessage(discorduser))
						displayIgn(discorduser, message.channel)
					})
			})
		} else {
			message.channel.send(ignNotFoundMessage(msg))
		}
	} else {
		mentions.forEach(mention => displayIgn(mention[1], message.channel))
	}
}

const displayIgn = (user, channel) => {
    const userdb = db.data.users
        .find(u => u.id === user.id)

    if (userdb) {
        channel.send(createEmbed(user.displayName,userdb))
    } else {
        channel.send(userNotFoundMessage(user.displayName))
    }
}

// set ign's in db
const setIgn = (message, mentions) => {
	if (!checkMentionsAndPriveleges(message,mentions))
		return
	let user = mentions.length === 1 ? mentions[0][1] : message.author
	let index = db.data.users.findIndex(u => u.id === user.id)
	if (index > -1)
		db.data.users.splice(index,1)
	db.data.users.push({"id": user.id, "accounts": parseAccounts(message)})
	db.write()
	message.channel.send(updateMessage(user))
}

//add ign to existing account
const addIgn = (message,mentions) => {
	if (!checkMentionsAndPriveleges(message,mentions))
		return
	let user = mentions.length === 1 ? mentions[0][1] : message.author
    const userdb = db.data.users
        .find(u => u.id === user.id)
	if(userdb) {
		userdb.accounts = userdb.accounts.concat(parseAccounts(message))
		db.write()
		message.channel.send(updateMessage(user))
	}
}

const ignMissing = async message => {
	let missing = await findMissing(message);
	message.channel.send(missingText(missing))
}

const findMissing = message => {
	var missing = [];
	return message.guild.members.fetch()
		.then(members => {
			members.filter(m => !m.user.bot).each(member => {
				if(!db.data.users.some(u => u.id === member.id)){
					missing.push(member);
				}
			})
			return missing;
		})
}

const findByIgn = message => {
	const ign = message.trim().toUpperCase()
	return db.data.users
		.filter(u => u.accounts.some(a => a.name.toUpperCase() === ign))
}

const parseAccounts = message => {
	let msg = message.content.substr(8) //remove !setign and !addign
	msg = msg.replace(/<@.*>/g, '')
	let spl = msg.split(',') //different accounts seperated by ,
	let accounts = []
	spl.forEach(s => {
		s = s.trim().split(':')
		accounts.push({"title": s[0], "name": s[1]})
	})
	return accounts
}

const checkMentionsAndPriveleges = (message,mentions) => {
	if (mentions.length > 0 && !message.member.hasPermission("ADMINISTRATOR")){
		message.channel.send(unauthorizedMessage)
		return false
	}
	if (mentions.length > 1) {
		message.channel.send(tooManyMentionsMessage)
		return false
	}
	return true
}

// Discord listeners
client.on('message', async message => {
    if (message.author.bot || message.content.includes('@here') || message.content.includes('@everyone'))
        return false
	msg = message;

	return handleNewMessage(message)
})

process.on('uncaughtException', err => {
	console.log(err)
	msg.channel.send(errorMessage)
})

// Let's go
console.log('Ready!')
client.user.setActivity('!whois, !setign, !addign', '!ignmissing', { type: 'LISTENING' })
