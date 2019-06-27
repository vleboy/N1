// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const LogModel = require('./model/LogModel')
const BaseModel = require('./model/BaseModel')
const UserModel = require('./model/UserModel')
const Cache = require('./lib/Cache')

/**
 * 清除指定的日志
 * @param {*} role 日志角色
 */
router.post('/stat/clearData', async function (ctx, next) {
    const inparam = ctx.request.body
    // 业务操作
    await new LogModel().delLog(inparam)
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 清除redis缓存
 */
router.post('/stat/clearRedis', async function (ctx, next) {
    const inparam = ctx.request.body
    console.log(await new Cache().keys())
    new Cache().flushall()
    console.log(await new Cache().keys())
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 清空余额缓存
 * @param {*} type 
 */
router.post('/stat/clearBalanceCache', async function (ctx, next) {
    // const inparam = ctx.request.body
    // 业务操作
    let res = await new BaseModel().scan({
        TableName: 'SYSCacheBalance'
    })
    console.log(`一共查出需要删除的条数${res.Items.length}`)
    // 批量删除
    for (let item of res.Items) {
        await new BaseModel().deleteItem({
            TableName: 'SYSCacheBalance',
            Key: {
                'userId': item.userId,
                'type': item.type,
            }
        })
    }
    console.info(`数据删除成功`)
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 清楚NA下所有代理的数据
 */
router.get('/stat/clearAgentAll', async (ctx, next) => {
    //查出所有的代理
    let res = await new UserModel().query({
        KeyConditionExpression: '#role = :role',
        ProjectionExpression: "userId",
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':role': '1000' }
    })
    console.log(`一共需要删除的代理有${res.Items.length}个`)
    //删除代理的流水、代理的缓存、代理下玩家的流水、代理下玩家的战绩、代理下玩家局表、代理下玩家的局天表、代理下的玩家
    let i = 1
    for (let agent of res.Items) {
        console.log(`开始删除第${i}个代理数据`)
        //删除代理的缓存
        await delCache(agent)
        //删除代理的流水
        await delBill(agent)
        //删除代理下的玩家流水
        await delPlayerBill(agent)
        //删除代理下的玩家战绩
        await delPlayerRecord(agent)
        //删除代理下的玩家局表
        await delPlayerRound(agent)
        //删除代理下的玩家局天表
        await delPlayerRoundDay(agent)
        //删除代理下的玩家
        await delPlayer(agent)
        console.log(`删除第${i}个代理数据完成`)
        i++
    }
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 内部方法
 */

 //删除代理的缓存
async function delCache(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().query({
        TableName: 'SYSCacheBalance',
        KeyConditionExpression: 'userId = :userId',
        ProjectionExpression: 'userId,#type',
        ExpressionAttributeNames: { '#type': 'type' },
        ExpressionAttributeValues: { ':userId': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'SYSCacheBalance', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除缓存${ret.Items.length}条`)
}

//删除代理的流水
async function delBill(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().query({
        TableName: 'ZeusPlatformBill',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ProjectionExpression: 'sn,userId',
        ExpressionAttributeValues: { ':userId': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'ZeusPlatformBill', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除流水${ret.Items.length}条`)
}

//删除代理下玩家流水
async function delPlayerBill(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().query({
        TableName: 'PlayerBillDetail',
        IndexName: 'ParentIndex',
        KeyConditionExpression: '#parent  = :parent',
        ProjectionExpression: 'sn',
        ExpressionAttributeNames: { '#parent': 'parent' },
        ExpressionAttributeValues: { ':parent': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'PlayerBillDetail', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除代理下流水${ret.Items.length}条`)
}
//删除代理下玩家战绩
async function delPlayerRecord(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().queryOnce({
        TableName: 'HeraGameRecord',
        IndexName: 'parentIdIndex',
        KeyConditionExpression: 'parentId  = :parentId',
        ProjectionExpression: 'userName,betId ',
        ExpressionAttributeValues: { ':parentId': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'HeraGameRecord', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除代理下玩家战绩${ret.Items.length}条`)
}
//删除代理下玩家局表
async function delPlayerRound(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().query({
        TableName: 'StatRound',
        IndexName: 'ParentIndex',
        KeyConditionExpression: '#parent  = :parent',
        ProjectionExpression: 'businessKey',
        ExpressionAttributeNames: { '#parent': 'parent' },
        ExpressionAttributeValues: { ':parent': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'StatRound', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除代理下玩家局表${ret.Items.length}条`)
}
//删除代理下玩家局天表
async function delPlayerRoundDay(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().query({
        TableName: 'StatRoundDay',
        IndexName: 'ParentIndex',
        KeyConditionExpression: '#parent  = :parent',
        ProjectionExpression: 'userName,createdDate',
        ExpressionAttributeNames: { '#parent': 'parent' },
        ExpressionAttributeValues: { ':parent': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'StatRoundDay', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除代理下玩家局天表${ret.Items.length}条`)
}
//删除代理下的玩家
async function delPlayer(agentInfo) {
    let promiseArr = []
    const ret = await new BaseModel().query({
        TableName: 'HeraGamePlayer',
        IndexName: 'parentIdIndex',
        KeyConditionExpression: '#parent  = :parent',
        ProjectionExpression: 'userName',
        ExpressionAttributeNames: { '#parent': 'parent' },
        ExpressionAttributeValues: { ':parent': agentInfo.userId }
    })
    // 批量删除
    for (let item of ret.Items) {
        promiseArr.push(new BaseModel().deleteItem({ TableName: 'HeraGamePlayer', Key: item }))
    }
    await Promise.all(promiseArr)
    console.info(`删除代理玩家${ret.Items.length}条`)
}

// /**
//  * 清除指定的流水
//  * @param {*} type 
//  */
// router.post('/stat/clearBill', async function (ctx, next) {
//     // const inparam = ctx.request.body
//     // 业务操作
//     let [err, logs] = await new BaseModel().query({
//         TableName: 'PlayerBillDetail',
//         IndexName: 'TypeIndex',
//         KeyConditionExpression: '#type = :type',
//         ProjectionExpression: "sn",
//         ExpressionAttributeNames: {
//             '#type': 'type'
//         },
//         ExpressionAttributeValues: {
//             ':type': 21,
//             // ':type': 1,
//             // ':type': 2
//         }
//     })
//     if (err) {
//         console.log(err)
//     }
//     console.log(`一共查出需要删除的流水条数${logs.Items.length}`)
//     // 批量删除
//     for (let item of logs.Items) {
//         new BaseModel().deleteItem({
//             TableName: 'PlayerBillDetail',
//             Key: {
//                 'sn': item.sn
//             }
//         })
//     }
//     console.info(`数据删除成功`)
//     ctx.body = { code: 0, msg: 'Y' }
// })

module.exports = router