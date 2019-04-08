const cron = require('node-cron')
const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-southeast-1' })
const dbClient = new AWS.DynamoDB.DocumentClient()
// 定时服务
cron.schedule('*/30 * * * * *', () => {
})