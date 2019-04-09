const cron = require('node-cron')
const nodebatis = global.nodebatis
const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-southeast-1' })
const dbClient = new AWS.DynamoDB.DocumentClient()

function queryInc(params, result) {
    return dbClient.query(params).promise().then((res) => {
        if (!result) {
            result = res
        } else {
            result.Items.push(...res.Items)
        }
        if (res.LastEvaluatedKey) {
            console.log(111)
            params.ExclusiveStartKey = res.LastEvaluatedKey
            return queryInc(params, result)
        } else {
            return result
        }
    }).catch((err) => {
        return err
    })
}

// 定时服务
cron.schedule('*/30 * * * * *', async () => {
    let configArr = await nodebatis.query('config.findOne', { type: 'queryTime' })
    if (configArr[0].flag) {
        let startTime = configArr[0].createdAt
        await nodebatis.execute('config.updateFlag', { type: 'queryTime', flag: 'false' })
        let endTime = startTime + 24 * 60 * 60 * 1000 > Date.now() ? Date.now() : startTime + 24 * 60 * 60 * 1000
        let result = await queryInc({
            TableName: 'PlayerBillDetail',
            IndexName: 'TypeIndex',
            KeyConditionExpression: '#type=:type AND createdAt BETWEEN :createdAt1 AND :createdAt2',
            ProjectionExpression: 'sn,businessKey,parent,userId,userName,gameType,gameId,#type,originalAmount,amount,balance,sourceIP,createdAt',
            ExpressionAttributeNames: {
                '#type': 'type'
            },
            ExpressionAttributeValues: {
                ':type': 3,
                ':createdAt1': startTime,
                ':createdAt2': endTime
            }
        })
        //插入数据
        console.log(`写入数据共${result.Items.length}条`)
        if (result.Items.length != 0) {
            await nodebatis.execute('bill.batchInsert', { data: result.Items })
        }
        await nodebatis.execute('config.updateOne', { type: 'queryTime', createdAt: endTime, flag: 'true' })
    }

})





