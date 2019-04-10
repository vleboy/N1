const cron = require('node-cron')
const dayjs = require('dayjs')
const _ = require('lodash')
const IP2Region = require('ip2region')
const ipquery = new IP2Region()
const axios = require('axios')
const nodebatis = global.nodebatis
const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-southeast-1' })
const dbClient = new AWS.DynamoDB.DocumentClient()

//数据库查询
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
//ip查询
function queryIp(ip) {
    let ipObj = ipquery.search(ip)
    if (ipObj && ipObj.country != '0') {
        return [ipObj.country, ipObj.province, ipObj.city]
    } else {
        try {
            // 淘宝IP查询
            let res = await axios.get(`http://ip.taobao.com/service/getIpInfo.php?ip=${ip}`)
            if (res.data && res.data.data.country && res.data.data.county != 'XX') {
                return [res.data.data.country, res.data.data.region, res.data.data.city]
            } else {
                return ['其他', '其他', '其他']
            }
        } catch (error) {
            // 其他IP查询
            let res2 = await axios.get(`http://freeapi.ipip.net/${ip}`)
            if (res2.data && res2.data.length > 0 && res2.data != 'not found' && res2.data[0] != '保留地址' && res2.data[0] != '局域网') {
                return [res2.data[0], res2.data[1], res2.data[2]]
            } else {
                return ['其他', '其他', '其他']
            }
        }
    }
}

// 定时服务
cron.schedule('*/30 * * * * *', async () => {
    console.time('【全部载入】')
    let configArr = await nodebatis.query('config.findOne', { type: 'queryTime' })
    if (configArr[0].flag) {
        // 读取
        await nodebatis.execute('config.updateFlag', { type: 'queryTime', flag: 0 })
        let startTime = configArr[0].createdAt
        let nowTime = Date.now()
        let endTime = startTime + configArr[0].rangeHour * 3600000 > nowTime ? nowTime : startTime + configArr[0].rangeHour * 3600000
        console.time(`读取 ${dayjs(startTime).format('YYYY-MM-DD HH:mm:ss')} 至 ${dayjs(endTime).format('YYYY-MM-DD HH:mm:ss')} 流水`)
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
        console.timeEnd(`读取 ${dayjs(startTime).format('YYYY-MM-DD HH:mm:ss')} 至 ${dayjs(endTime).format('YYYY-MM-DD HH:mm:ss')} 流水`)
        // 写入
        console.time(`写入 ${resArr[0].Items.length + resArr[1].Items.length + resArr[2].Items.length}条`)
        let promiseWriteArr = []
        for (let res of resArr) {
            if (res.Items.length > 0) {
                let chunkArr = _.chunk(res.Items, 100)
                for (let arr of chunkArr) {
                    promiseWriteArr.push(nodebatis.execute('bill.batchInsert', {
                        data: arr.map((item) => {
                            item.sourceIP = (item.sourceIP || '0.0.0.0').toLowerCase()
                            if (item.sourceIP.startWith('::ffff:')) {
                                item.sourceIP = item.sourceIP.split('::ffff:')[1]
                            }
                            let ipArr = queryIp(item.sourceIP)
                            item.country = ipArr[0]
                            item.province = ipArr[1]
                            item.city = ipArr[2]
                            return item
                        })
                    }))
                }
            }
        }
        await Promise.all(promiseWriteArr)
        await nodebatis.execute('config.updateOne', { type: 'queryTime', createdAt: endTime + 1, flag: 1 })
        console.timeEnd(`写入 ${resArr[0].Items.length + resArr[1].Items.length + resArr[2].Items.length}条`)
    }
    console.timeEnd('【全部载入】')
})





