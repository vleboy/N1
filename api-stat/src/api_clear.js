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
    let [err, res] = await new BaseModel().scan({
        TableName: 'SYSCacheBalance'
    })
    if (err) {
        console.log(err)
    }
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