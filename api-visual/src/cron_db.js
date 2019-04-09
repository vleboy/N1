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
        // 读取
        await nodebatis.execute('config.updateFlag', { type: 'queryTime', flag: 0 })
        let startTime = configArr[0].createdAt
        let endTime = startTime + 24 * 60 * 60 * 1000 > Date.now() ? Date.now() : startTime + 24 * 60 * 60 * 1000
        let promiseReadArr = []
        for (let i = 3; i <= 5; i++) {
            promiseReadArr.push(queryInc({
                TableName: 'PlayerBillDetail',
                IndexName: 'TypeIndex',
                KeyConditionExpression: '#type=:type AND createdAt BETWEEN :createdAt1 AND :createdAt2',
                ProjectionExpression: 'sn,businessKey,parent,userId,userName,gameType,gameId,#type,originalAmount,amount,balance,sourceIP,createdAt',
                ExpressionAttributeNames: {
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':type': i,
                    ':createdAt1': startTime,
                    ':createdAt2': endTime
                }
            }))
        }
        let resArr = await Promise.all(promiseReadArr)
        // 写入
        let promiseWriteArr = []
        for (let res of resArr) {
            if (res.Items.length > 0) {
                promiseWriteArr.push(nodebatis.execute('bill.batchInsert', {
                    data: res.Items.map((item) => {
                        item.sourceIP = item.sourceIP || '0.0.0.0'
                        return item
                    })
                }))
            }
        }
        await Promise.all(promiseWriteArr)
        await nodebatis.execute('config.updateOne', { type: 'queryTime', createdAt: endTime, flag: 1 })
    }
})





