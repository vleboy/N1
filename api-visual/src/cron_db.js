const cron = require('node-cron')
const dayjs = require('dayjs')
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
        console.error(err)
        return err
    })
}

// 定时服务
cron.schedule('*/30 * * * * *', async () => {
    console.time('流水数据载入')
    let configArr = await nodebatis.query('config.findOne', { type: 'queryTime' })
    if (configArr[0].flag) {
        // 读取
        await nodebatis.execute('config.updateFlag', { type: 'queryTime', flag: 0 })
        let startTime = configArr[0].createdAt
        let nowTime = Date.now()
        let endTime = startTime + 3600000 > nowTime ? nowTime : startTime + 3600000
        console.time(`读取${dayjs(startTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${dayjs(endTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}流水`)
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
        console.timeEnd(`读取${dayjs(startTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}至${dayjs(endTime).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')}流水`)
        // 写入
        console.time(`写入${resArr[0].Items.length + resArr[1].Items.length + resArr[2].Items.length}条`)
        let promiseWriteArr = []
        for (let res of resArr) {
            if (res.Items.length > 0) {
                promiseWriteArr.push(nodebatis.execute('bill.batchInsert', {
                    data: res.Items.map((item) => {
                        item.sourceIP = item.sourceIP || '0.0.0.0'
                        item.region = '其他'
                        return item
                    })
                }))
            }
        }
        await Promise.all(promiseWriteArr)
        await nodebatis.execute('config.updateOne', { type: 'queryTime', createdAt: endTime, flag: 1 })
        console.timeEnd(`写入${resArr[0].Items.length + resArr[1].Items.length + resArr[2].Items.length}条`)
    }
    console.timeEnd('流水数据载入')
})





