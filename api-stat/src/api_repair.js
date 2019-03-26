// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
const NP = require('number-precision')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const LogModel = require('./model/LogModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const UserModel = require('./model/UserModel')
const PushModel = require('./model/PushModel')
const PlayerModel = require('./model/PlayerModel')

/**
 * 修正因为下注延迟没有被记录的返奖
 */
router.post('/stat/fixRet', async function (ctx, next) {
    const inparam = ctx.request.body
    // 业务操作
    console.log('开始返奖补录')
    let [err, res] = await new LogModel().roleQuery({ role: '2' })
    for (let item of res) {
        // NA电子游戏重推返奖
        if (item.detail.indexOf('未找到对应BK【B') != -1) {
            let billCheck = await new PlayerBillDetailModel().getItem({
                ProjectionExpression: 'createdAt',
                Key: {
                    'sn': item.inparams.sn
                }
            })
            if (!_.isEmpty(billCheck.Item)) {
                console.log(`${item.inparams.businessKey}已修复`)
                new LogModel().updateLog({ sn: item.sn, userId: item.userId })
            } else {
                console.log(`${item.inparams.businessKey}重推`)
                await axios.post(`https://${config.na.domain}/dev/game/postTransfer`, JSON.parse(item.inparams.anotherGameData))
            }
        }
        // DT电子游戏重推返奖
        if (item.detail.indexOf('未找到对应BK【BDT_') != -1) {
            let billCheck = await new PlayerBillDetailModel().getItem({
                ProjectionExpression: 'createdAt',
                Key: {
                    'sn': item.inparams.sntemp
                }
            })
            if (!_.isEmpty(billCheck.Item)) {
                console.log(`${item.inparams.businessKey}已修复`)
                new LogModel().updateLog({ sn: item.sn, userId: item.userId })
            } else {
                console.log(`${item.inparams.businessKey}重推`)
                await axios.post(`https://${config.na.apidomain}/dt/ret`, JSON.parse(item.inparams.anotherGameData))
            }
        }
        // TTG电子游戏重推返奖
        // if (item.detail.indexOf('未找到对应BK【BTTG_') != -1) {
        //     let billCheck = await new PlayerBillDetailModel().getItem({
        //         ProjectionExpression: 'createdAt',
        //         Key: {
        //             'sn': item.inparams.sntemp
        //         }
        //     })
        //     if (!_.isEmpty(billCheck.Item)) {
        //         console.log(`${item.inparams.businessKey}已修复`)
        //         new LogModel().updateLog({ sn: item.sn, userId: item.userId })
        //     } else {
        //         console.log(`${item.inparams.businessKey}重推`)
        //         await axios.post(`https://${config.na.apidomain}/dt/postTransfer`, JSON.parse(item.inparams.anotherGameData))
        //     }
        // }
    }
    console.log('返奖已经补录完毕')
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 修正所有流水的amount为2位小数
 */
router.post('/stat/fixBillAmount', async function (ctx, next) {
    const inparam = ctx.request.body
    console.log('开始修补流水2位小数')
    let [err, res] = await new PlayerBillDetailModel().query({
        IndexName: 'UserNameIndex',
        KeyConditionExpression: '#userName = :userName AND createdAt >= :createdAt',
        ProjectionExpression: 'sn,amount,originalAmount,balance',
        ExpressionAttributeNames: {
            '#userName': 'userName'
        },
        ExpressionAttributeValues: {
            ':userName': inparam.userName,
            ':createdAt': inparam.createdAt,
        }
    })
    for (let i = 0; i < res.Items.length; i++) {
        let amountStr = res.Items[i].amount.toString()
        if (amountStr.split('.')[1] && amountStr.split('.')[1].length > 2) {
            console.log(amountStr.split('.')[1])
            await new PlayerBillDetailModel().updateItem({
                Key: { sn: res.Items[i].sn },
                UpdateExpression: 'SET amount=:amount',
                ExpressionAttributeValues: {
                    ':amount': NP.round(res.Items[i].amount, 2),
                }
            })
        }
    }
    console.log('结束修补流水2位小数')
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 修正玩家流水前置和后置金额一致性
 */
router.post('/stat/fixBill', async function (ctx, next) {
    const inparam = ctx.request.body
    console.log('开始修补流水')
    let [err, res] = await new PlayerBillDetailModel().query({
        IndexName: 'UserNameIndex',
        KeyConditionExpression: '#userName = :userName AND createdAt >= :createdAt',
        ProjectionExpression: 'sn,amount,originalAmount,balance',
        ExpressionAttributeNames: {
            '#userName': 'userName'
        },
        ExpressionAttributeValues: {
            ':userName': inparam.userName,
            ':createdAt': inparam.createdAt,
        }
    })
    // i是正确基础数据
    // i+1是需要修复的下一条数据
    for (let i = 0; i < res.Items.length - 1; i++) {
        let nextIndex = i + 1                        // 需要修复的下一条
        let originalAmount = +res.Items[i].balance   // 以前一条的余额作为下一条的原始金额
        // 原始金额加上变化金额，就是下一条的新余额
        let newBalance = NP.plus(originalAmount, res.Items[nextIndex].amount)
        // console.log(`【${res.Items[nextIndex].sn}】被修复originalAmount:${originalAmount}，newBalance:${newBalance}`)
        await new PlayerBillDetailModel().updateItem({
            Key: { sn: res.Items[nextIndex].sn },
            UpdateExpression: 'SET originalAmount=:originalAmount,balance=:balance',
            ExpressionAttributeValues: {
                ':originalAmount': originalAmount,
                ':balance': newBalance
            }
        })
        // 更新下一条的原始金额和新余额，作为再下一条的修复基础数据
        res.Items[nextIndex].originalAmount = originalAmount
        res.Items[nextIndex].balance = newBalance
        console.log(`${res.Items.length}:${i}`)

    }
    console.log('结束修补流水')
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 补写战绩
 */
router.post('/stat/fixGameRecord', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    for (let item of inparam) {
        let [err, res] = await new PlayerBillDetailModel().query({
            IndexName: 'BusinessKeyIndex',
            KeyConditionExpression: 'businessKey = :businessKey',
            ExpressionAttributeValues: {
                ':businessKey': item
            }
        })
        let bet = res.Items[0]
        let ret = res.Items[1]
        if (bet && ret) {
            let record = JSON.parse(ret.anotherGameData)
            await new HeraGameRecordModel().putItem({
                userId: +bet.userId,
                userName: bet.userName,
                betId: bet.businessKey,
                parentId: bet.parent,
                gameId: record.gameId.toString(),
                gameType: +bet.gameType,
                betTime: +bet.createdAt,
                createdAt: +ret.createdAt,
                record: record.gameRecord
            })
        }
    }
    console.log('修复完毕')
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 修正流水action
 */
router.post('/stat/fixBillAction', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    let [err, res] = await new PlayerBillDetailModel().query({
        IndexName: 'TypeIndex',
        KeyConditionExpression: '#type = :type',
        ProjectionExpression: 'sn,amount,#action',
        ExpressionAttributeNames: {
            '#type': 'type',
            '#action': 'action'
        },
        ExpressionAttributeValues: {
            ':type': +inparam.type
        }
    })
    console.log(`类型${inparam.type}的流水数量:${res.Items.length}`)
    for (let bill of res.Items) {
        // 金额小于0，action为-1
        if (+bill.amount < 0 && +bill.action >= 0) {
            console.log(`${bill.sn}的amount是${bill.amount}将action修正为-1`)
            await new PlayerBillDetailModel().updateItem({
                Key: { sn: bill.sn },
                UpdateExpression: 'SET #action=:action',
                ExpressionAttributeNames: {
                    '#action': 'action'
                },
                ExpressionAttributeValues: {
                    ':action': -1
                }
            })
        }
        // 金额大于等于0，action为1
        if (+bill.amount >= 0 && +bill.action < 0) {
            console.log(`${bill.sn}的amount是${bill.amount}将action修正为1`)
            await new PlayerBillDetailModel().updateItem({
                Key: { sn: bill.sn },
                UpdateExpression: 'SET #action=:action',
                ExpressionAttributeNames: {
                    '#action': 'action'
                },
                ExpressionAttributeValues: {
                    ':action': 1
                }
            })
        }
    }
    console.log('修正完毕')
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 重推用户给大厅
 */
router.post('/stat/repush', async function (ctx, next) {
    let [err, res] = await new UserModel().scan({
        ProjectionExpression: 'userId'
        // FilterExpression: `isTest = :isTest`,
        // ExpressionAttributeValues: {
        //     ':isTest': 1
        // }
    })
    let i = 1
    console.log(`需要重推用户数量：${res.Items.length}`)
    for (let user of res.Items) {
        await new PushModel().pushMerchant(user.userId)
        console.log(`当前重推进度：${i}`)
        i++
    }
})

/**
 * 给商户玩家增加parentSn字段,移除部分字段
 * 用户表这三个字段预留hostName，hostContact，merchantEmail
 */
router.post('/stat/updateTable', async function (ctx, next) {
    //查询所有玩家
    let playerModel = new PlayerModel()
    let [playerErr, players] = await playerModel.scan({
        ProjectionExpression: 'parent,userName,gameId,sid'
    })
    for (let playerInfo of players.Items) {
        let gameId = +playerInfo.gameId || 0
        let sid = +playerInfo.sid || 0
        await playerModel.updateItem({
            Key: { userName: playerInfo.userName },
            UpdateExpression: 'SET gameId=:gameId,sid=:sid',
            ExpressionAttributeValues: { ":gameId": gameId, ":sid": sid }
        })
    }
    // let userModel = new UserModel()
    // let [userErr, users] = await userModel.scan({
    //     ProjectionExpression: '#role,userId',
    //     ExpressionAttributeNames: {
    //         '#role': 'role'
    //     }
    // })
    // //所有玩家parent分组
    // let parentGroup = _.groupBy(players.Items, 'parent')
    // let promiseArr = []
    // for (let parent in parentGroup) {
    //     let p = new Promise(async (resolve, reject) => {
    //         //查询商户的sn
    //         let [userErr, userInfo] = await new UserModel().queryUserById(parent)
    //         if (!_.isEmpty(userInfo)) {
    //             for (let playerInfo of parentGroup[parent]) {
    //                 // 商户写入SN
    //                 if (userInfo.msn != '000' && userInfo.sn) {
    //                     await playerModel.updateItem({
    //                         Key: { userName: playerInfo.userName },
    //                         UpdateExpression: 'SET parentSn=:parentSn',
    //                         ExpressionAttributeValues: { ':parentSn': userInfo.sn }
    //                     })
    //                 }
    //             }
    //         } else {
    //             console.log(`用户id:${parent}已经不存在!该用户下的玩家可以删除。。。`)
    //         }
    //         resolve(1)
    //     })
    //     promiseArr.push(p)
    // }
    // await Promise.all(promiseArr)
    // console.log('开始移除无用字段')
    // // 移除玩家表的无用属性
    // for (let player of players.Items) {
    //     await playerModel.updateItem({
    //         Key: { userName: player.userName },
    //         UpdateExpression: 'REMOVE sessionId,lastCacheTime,lastStatTime'
    //     })
    // }
    // // 移除用户表的无用属性
    // for (let user of users.Items) {
    //     await userModel.updateItem({
    //         Key: { role: user.role, userId: user.userId },
    //         UpdateExpression: 'REMOVE gender,isforever,enabledAt,children,contractPeriod'
    //     })
    // }
    // 移除流水表无用属性tableId，mix
    console.log('结束')
    ctx.body = { code: 0, msg: 'Y' }
})

//修正时间范围内战绩没有betTime字段数据
router.post('/stat/fixRecrodBetTime', async function (ctx, next) {
    //获取入参
    const inparam = ctx.request.body
    //查询时间范围流水
    const [err, ret] = await new PlayerBillDetailModel().query({
        IndexName: 'TypeIndex',
        ProjectionExpression: 'userName,businessKey,createdAt',
        KeyConditionExpression: '#type =:type AND createdAt BETWEEN :createdAt0 AND :createdAt1',
        FilterExpression: 'gameType = :gameType1 OR gameType = :gameType2 OR gameType = :gameType3',
        ExpressionAttributeNames: {
            '#type': 'type'
        },
        ExpressionAttributeValues: {
            ':type': 3,
            ':gameType1': 40000,
            ':gameType2': 70000,
            ':gameType3': 90000,
            ':createdAt0': inparam.start,
            ':createdAt1': inparam.end
        }
    })
    if (err) {
        console.error(err)
    }
    console.log(`一共查出${ret.Items.length}条数据`)
    //更新战绩
    for (let item of ret.Items) {
        new HeraGameRecordModel().updateItem({
            Key: { 'userName': item.userName, 'betId': item.businessKey },
            UpdateExpression: 'SET betTime = :betTime',
            ExpressionAttributeValues: {
                ':betTime': item.createdAt
            }
        }).catch((err) => {
            console.error(err)
        })
    }
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 测试SSL
 */
router.get('/stat/test', async function (ctx, next) {
    ctx.body = 'ssl work'
})

module.exports = router