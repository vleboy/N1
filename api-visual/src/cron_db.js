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
function queryInc(type, params, result) {
    return dbClient[type](params).promise().then((res) => {
        if (!result) {
            result = res
        } else {
            result.Items.push(...res.Items)
        }
        if (res.LastEvaluatedKey) {
            params.ExclusiveStartKey = res.LastEvaluatedKey
            return queryInc(type, params, result)
        } else {
            return result
        }
    }).catch((err) => {
        console.error(err)
        return err
    })
}

//ip查询
async function queryIp(ip) {
    if (ip == '0.0.0.0') {
        return ['其他', '其他', '其他']
    }
    let ipObj = ipquery.search(ip)
    if (ipObj && ipObj.country != '0') {
        return [ipObj.country, ipObj.province, ipObj.city]
    } else {
        try {
            // 淘宝IP查询
            let res = await axios.get(`http://ip.taobao.com/service/getIpInfo.php?ip=${ip}`)
            if (res.data && res.data.data.country && res.data.data.country != 'XX') {
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

// 流水定时服务
cron.schedule('*/30 * * * * *', async () => {
    console.time('【流水载入】')
    let configArr = await nodebatis.query('config.findOne', { type: 'queryTime' })
    if (configArr[0].flag) {
        await nodebatis.execute('config.updateFlag', { type: 'queryTime', flag: 0 })
        let startTime = configArr[0].createdAt
        let nowTime = Date.now() - 3 * 60 * 1000
        let endTime = startTime + configArr[0].rangeHour * 3600000 > nowTime ? nowTime : startTime + configArr[0].rangeHour * 3600000
        // console.time(`读取 ${dayjs(startTime).format('YYYY-MM-DD HH:mm:ss')} 至 ${dayjs(endTime).format('YYYY-MM-DD HH:mm:ss')} 流水`)
        let promiseReadArr = []
        for (let i = 3; i <= 5; i++) {
            promiseReadArr.push(queryInc('query', {
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
        // 查询用户表，获得所有用户
        promiseReadArr.push(queryInc('scan', {
            TableName: 'ZeusPlatformUser',
            ProjectionExpression: 'userId,#role,sn,username,displayId,displayName',
            ExpressionAttributeNames: { '#role': 'role' },
            FilterExpression: `#role = :role100 or #role = :role1000`,
            ExpressionAttributeValues: {
                ':role100': '100',
                ':role1000': '1000'
            }
        }))
        let resArr = await Promise.all(promiseReadArr)
        let userMap = {}
        for (let item of resArr[3].Items) {
            userMap[item.userId] = item
        }
        resArr = resArr[0].Items.concat(resArr[1].Items.concat(resArr[2].Items))
        // console.timeEnd(`读取 ${dayjs(startTime).format('YYYY-MM-DD HH:mm:ss')} 至 ${dayjs(endTime).format('YYYY-MM-DD HH:mm:ss')} 流水`)
        console.time(`写入流水${resArr.length} 条`)
        let ipMap = {}
        let promiseWriteArr = []
        if (resArr.length > 0) {
            let ipGroup = _.groupBy(resArr, 'sourceIP')
            for (let ip in ipGroup) {
                ip = ip == 'undefined' ? '0.0.0.0' : ip
                ip = (ip || '0.0.0.0').toLowerCase()
                if (ip.indexOf('::ffff:') != -1) {
                    ip = ip.split('::ffff:')[1]
                }
                ipMap[ip] = await queryIp(ip)
            }
            let chunkArr = _.chunk(resArr, 100)
            for (let arr of chunkArr) {
                promiseWriteArr.push(nodebatis.execute('bill.batchInsert', {
                    data: arr.map((item) => {
                        item.sourceIP = (item.sourceIP || '0.0.0.0').toLowerCase()
                        if (item.sourceIP.indexOf('::ffff:') != -1) {
                            item.sourceIP = item.sourceIP.split('::ffff:')[1]
                        }
                        item.country = ipMap[item.sourceIP][0]
                        item.province = ipMap[item.sourceIP][1]
                        item.city = ipMap[item.sourceIP][2]
                        // 补充父级用户信息
                        item.parentRole = userMap[item.parent].role
                        item.parentSn = userMap[item.parent].sn || 'NULL!'
                        item.parentName = userMap[item.parent].username
                        item.parentDisplayId = userMap[item.parent].displayId || 0
                        item.parentDisplayName = userMap[item.parent].displayName
                        return item
                    })
                }))
            }
        }
        await Promise.all(promiseWriteArr)
        await nodebatis.execute('config.updateOne', { type: 'queryTime', createdAt: endTime + 1, flag: 1 })
        console.timeEnd(`写入流水${resArr.length} 条`)
    }
    console.timeEnd('【流水载入】')
})

// 玩家/用户定时服务
cron.schedule('0 0 1 * * *', async () => {
    console.time('【玩家载入】')
    let configArr = await nodebatis.query('config.findOne', { type: 'queryTime' })
    let startTime = configArr[0].playerCreatedAt
    let endTime = Date.now()
    let res = await queryInc('scan', {
        TableName: 'HeraGamePlayer',
        ProjectionExpression: 'userName,userId,nickname,buId,parent,parentName,parentSn,msn,createdAt,createAt',
        FilterExpression: `createAt between :createAt0 and :createAt1`,
        ExpressionAttributeValues: {
            ':createAt0': startTime,
            ':createAt1': endTime
        }
    })
    console.time(`写入玩家${res.Items.length} 条`)
    let promiseWriteArr = []
    if (res.Items.length > 0) {
        let chunkArr = _.chunk(res.Items, 100)
        for (let arr of chunkArr) {
            promiseWriteArr.push(nodebatis.execute('player.batchInsert', {
                data: arr.map((item) => {
                    item.createdAt = item.createdAt ? item.createdAt : item.createAt
                    item.parentSn = item.parentSn || 'NULL!'
                    item.parentName = item.parentName || 'NULL!'
                    return item
                })
            }))
        }
    }
    await Promise.all(promiseWriteArr)
    console.timeEnd(`写入玩家${res.Items.length} 条`)
    console.timeEnd('【玩家载入】')

    console.time('【用户载入】')
    res = await queryInc('scan', {
        TableName: 'ZeusPlatformUser',
        ProjectionExpression: '#role,userId,displayId,displayName,username,sn,#suffix,uname,#level,levelIndex,msn,#parent,parentName,parentDisplayName,parentSuffix,parentRole,createdAt',
        ExpressionAttributeNames: { '#role': 'role', '#suffix': 'suffix', '#level': 'level', '#parent': 'parent' },
        FilterExpression: `createdAt between :createdAt0 and :createdAt1`,
        ExpressionAttributeValues: {
            ':createdAt0': startTime,
            ':createdAt1': endTime
        }
    })
    console.time(`写入用户${res.Items.length} 条`)
    promiseWriteArr = []
    if (res.Items.length > 0) {
        let chunkArr = _.chunk(res.Items, 100)
        for (let arr of chunkArr) {
            promiseWriteArr.push(nodebatis.execute('user.batchInsert', {
                data: arr.map((item) => {
                    item.sn = item.sn || 'NULL!'
                    item.suffix = item.suffix || 'NULL!'
                    item.msn = item.msn || 'NULL!'
                    item.displayId = item.displayId || 0
                    item.displayName = item.displayName || 'NULL!'
                    item.parentDisplayName = item.parentDisplayName || 'NULL!'
                    item.parentSuffix = item.parentSuffix || 'NULL!'
                    return item
                })
            }))
        }
    }
    await Promise.all(promiseWriteArr)
    console.timeEnd(`写入用户${res.Items.length} 条`)
    console.timeEnd('【用户载入】')

    await nodebatis.execute('config.updatePlayerCreatedAt', { type: 'queryTime', playerCreatedAt: endTime + 1 })
})

