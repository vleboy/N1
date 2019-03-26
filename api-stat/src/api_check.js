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
const BaseModel = require('./model/BaseModel')
const StatRoundModel = require('./model/StatRoundModel')
const HeraGameRecordModel = require('./model/HeraGameRecordModel')
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const UserModel = require('./model/UserModel')
const Tables = require('./lib/Model').Tables

/**
 * 强制离线所有玩家
 */
router.post('/stat/checkPlayerGameState', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    // 查询出所有在线的玩家
    let [playerErr, playerRes] = await new BaseModel().scan({
        TableName: Tables.HeraGamePlayer,
        ProjectionExpression: 'userName,userId',
        FilterExpression: `gameState<>:gameState`,
        ExpressionAttributeValues: {
            ':gameState': 1
        }
    })
    console.log(playerRes.Items.length)
    for (let item of playerRes.Items) {
        await new BaseModel().updateItem({
            TableName: Tables.HeraGamePlayer,
            Key: { userName: item.userName },
            UpdateExpression: 'SET gameState = :gameState,gameId=:gameId',
            ExpressionAttributeValues: {
                ':gameState': 1,
                ':gameId': 0
            }
        })
    }
    console.log('完成')
    ctx.body = { code: 0, msg: 'Y' }
})

/**
 * 检查所有玩家余额和流水是否一致
 */
router.post('/stat/checkAllPlayerBalance', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    const playerModel = new PlayerModel()
    let [playerErr, playerRes] = await new BaseModel().scan({
        TableName: Tables.HeraGamePlayer,
        ProjectionExpression: 'parent,userName,userId,createAt,balance,#state',
        ExpressionAttributeNames: {
            '#state': 'state'
        }
    })
    console.log(`所有玩家数量：${playerRes.Items.length}`)
    // 查询所有玩家余额，每100个玩家一组
    let i = 0
    for (let playerArr of _.chunk(playerRes.Items, 100)) {
        try {
            let promiseArr = []
            for (let player of playerArr) {
                let p = playerModel.getNewBalance(player)
                promiseArr.push(p)
            }
            await Promise.all(promiseArr)
            i++
            console.log(i)
        } catch (error) {
            console.error(error)
        }
    }
    console.log('查询结束')
    ctx.body = { code: 0, msg: 'Y', payload: {} }
})

/**
 * 检查单个玩家余额和流水是否一致
 */
router.post('/stat/checkSignlePlayerBalance', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    let [playerErr, playerRes] = await new BaseModel().query({
        TableName: Tables.HeraGamePlayer,
        ProjectionExpression: 'parent,userName,userId,createAt,balance,#state',
        KeyConditionExpression: 'userName =:userName',
        ExpressionAttributeNames: {
            '#state': 'state'
        },
        ExpressionAttributeValues: {
            ':userName': inparam.userName
        }
    })
    //查询所有的流水并统计
    let res = await new PlayerModel().getNewBalance(playerRes.Items[0])
    console.log(res)
    ctx.body = { code: 0, msg: 'Y', payload: res }
})

/**
 * 检查战绩和交易记录是否一致
 * @param {*} gameType 游戏大类
 * @param {*} start 开始时间
 * @param {*} end 结束时间
 */
router.post('/stat/checkGameRecord', async function (ctx, next) {
    try {
        // 入参转换
        const inparam = ctx.request.body
        // 业务操作
        let gameRecordArr = []
        let gameRecordMap = {}
        let gameRecordCount = 0         // 战绩总数
        let gameRecordWinlose = 0       // 战绩输赢金额
        let roundArr = []
        let roundMap = {}
        let roundCount = 0              // 交易总数
        let roundWinlose = 0            // 交易输赢金额
        let promiseArr = []
        //获取平台所有商户和代理
        let [userErr, allUsers] = await new BaseModel().scan({
            TableName: Tables.ZeusPlatformUser,
            FilterExpression: "(#role = :role1 OR #role = :role2) AND levelIndex <> :levelIndex AND isTest <> :isTest",
            ProjectionExpression: 'userId,#role',
            ExpressionAttributeNames: { '#role': 'role' },
            ExpressionAttributeValues: {
                ':role1': '100',
                ':role2': '1000',
                ':levelIndex': '0',
                ':isTest': 1
            }
        })
        // 遍历处理每个商户/代理
        for (let user of allUsers.Items) {
            let p = new Promise(async (resolve, reject) => {
                // 查询战绩
                const [err, ret] = await new HeraGameRecordModel().query({
                    IndexName: 'parentIdIndex',
                    KeyConditionExpression: 'parentId = :parentId AND betTime between :createdAt0 and :createdAt1',
                    ProjectionExpression: 'betId,gameType,#record',
                    FilterExpression: 'gameType = :gameType',
                    ExpressionAttributeNames: { '#record': 'record' },
                    ExpressionAttributeValues: {
                        ':parentId': user.userId,
                        ':gameType': +inparam.gameType,
                        ':createdAt0': +inparam.start,
                        ':createdAt1': +inparam.end
                    }
                })
                // 查询交易
                const [err2, ret2] = await new StatRoundModel().query({
                    IndexName: 'ParentIndex',
                    KeyConditionExpression: 'parent = :parent AND createdAt between :createdAt0 and :createdAt1',
                    ProjectionExpression: 'businessKey,winloseAmount',
                    FilterExpression: 'gameType = :gameType',
                    ExpressionAttributeValues: {
                        ':parent': user.userId,
                        ':gameType': inparam.gameType,
                        ':createdAt0': inparam.start,
                        ':createdAt1': inparam.end
                    }
                })
                gameRecordCount = ret.Items.length
                roundCount = ret2.Items.length
                if (gameRecordCount == 0 && roundCount == 0) {
                    return resolve(false)
                }
                // 通过战绩计算输赢金额
                for (let item of ret.Items) {
                    gameRecordArr.push(item.betId)
                    if (item.gameType == 30000) {
                        gameRecordMap[item.betId] = parseFloat(item.record.winLostAmount)
                        gameRecordWinlose += parseFloat(item.record.winLostAmount)
                    }
                    if ((item.gameType == 40000 || item.gameType == 70000 || item.gameType == 90000) && item.record.gameDetail) {
                        let detail = JSON.parse(item.record.gameDetail)
                        if (!_.isEmpty(detail) && item.betId) {
                            gameRecordMap[item.betId] = (parseFloat(detail.totalGold) - parseFloat(detail.bet)) || 0
                            gameRecordWinlose += (parseFloat(detail.totalGold) - parseFloat(detail.bet)) || 0
                        } else {
                            console.error(item)
                        }
                    }
                    if (item.gameType == 50000) {
                        gameRecordMap[item.betId] = parseFloat(item.record.userWin) - parseFloat(item.record.totalBets)
                        gameRecordWinlose += parseFloat(item.record.userWin) - parseFloat(item.record.totalBets)
                    }
                }
                // 查询玩家交易记录输赢金额
                for (let item2 of ret2.Items) {
                    roundArr.push(item2.businessKey)
                    roundMap[item2.businessKey] = item2.winloseAmount
                    roundWinlose += item2.winloseAmount
                }
                // 对比战绩和交易记录
                for (let bk in gameRecordMap) {
                    if (!gameRecordMap[bk] && gameRecordMap[bk] != 0) {
                        console.error(bk)
                    }
                    if (!roundMap[bk] && roundMap[bk] !== 0) {
                        console.error(bk)
                    }
                    if (gameRecordMap[bk].toFixed(2) != roundMap[bk].toFixed(2)) {
                        console.log(`${bk} ：的输赢金额与交易记录不一致 ${gameRecordMap[bk]} 和 ${roundMap[bk]}`)
                    }
                }
                let loseArr = _.difference(roundArr, gameRecordArr)
                // let loseAmount = 0
                // for (let lose of loseArr) {
                //     loseAmount += roundMap[lose]
                // }
                // if (gameRecordCount != roundCount || loseAmount != 0 || loseArr.length != 0) {
                //     console.log(`${user.userId}的结果`)
                //     console.log(`战绩总数：${gameRecordCount}`)
                //     console.log(`交易总数：${roundCount}`)
                //     console.log(`战绩输赢金额：${gameRecordWinlose}`)
                //     console.log(`交易输赢金额：${roundWinlose}`)
                //     console.log(`战绩第一条：${ret.Items[0].betId}`)
                //     console.log(`交易第一条：${ret2.Items[0].businessKey}`)
                //     console.log(`战绩最后一条：${ret.Items[gameRecordCount - 1].betId}`)
                //     console.log(`交易最后一条：${ret2.Items[roundCount - 1].businessKey}`)
                //     console.log(`${user.userId}缺少以下战绩：`)
                //     console.log(JSON.stringify(loseArr))
                //     console.log(`${user.userId}缺少的输赢金额：${loseAmount}`)
                // }
                resolve(loseArr)
                // console.log(`单用户执行耗时：${Date.now() - time2}`)
            })
            promiseArr.push(p)
        }
        let resArr = await Promise.all(promiseArr)
        let finalArr = []
        for (let res of resArr) {
            if (res) {
                finalArr = finalArr.concat(res)
            }
        }
        finalArr = _.uniq(finalArr)
        let billArr = []
        for (let bk of finalArr) {
            let res = await new PlayerBillDetailModel().queryOnce({
                IndexName: 'BusinessKeyIndex',
                KeyConditionExpression: 'businessKey=:businessKey',
                ProjectionExpression: 'sn,businessKey,#type,userName,userId,originalAmount,balance,createdAt,amount',
                ExpressionAttributeNames: {
                    '#type': 'type'
                },
                ExpressionAttributeValues: {
                    ':businessKey': bk
                }
            })
            for (let bill of res.Items) {
                billArr.push(bill)
            }
        }
        console.log('缺失战绩对应的流水分组')
        console.log(JSON.stringify(_.groupBy(billArr, 'businessKey')))
        console.log('缺失的战绩数组')
        console.log(JSON.stringify(finalArr))
        ctx.body = { code: 0, msg: 'Y' }
    } catch (error) {
        console.error(error)
        ctx.body = { code: -1, msg: 'N' }
    }
})

/**
 * 检查流水与交易记录是否一致
 * @param {*} start 起始时间
 * @param {*} start 结束时间
 */
router.post('/stat/checkRoundBill', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    // 业务操作
    let billArr = []
    let roundArr = []
    let billBetCount = 0
    let repeatMap = {}
    let bkCountMap = {}
    let winloseAmount = 0
    let bkCount = 0
    let roundBetCount = 0
    // 查询流水
    let [err, ret] = await new BaseModel().query({
        TableName: 'PlayerBillDetail',
        IndexName: 'UserNameIndex',
        KeyConditionExpression: '#userName = :userName AND createdAt between :createdAt0 and :createdAt1',
        ProjectionExpression: 'sn,businessKey,amount,txnid,createdAt,createdStr,#type',
        FilterExpression: 'gameType = :gameType',
        ExpressionAttributeNames: {
            '#userName': 'userName',
            '#type': 'type',
        },
        ExpressionAttributeValues: {
            ':userName': inparam.userName,
            ':gameType': inparam.gameType,
            ':createdAt0': inparam.start,
            ':createdAt1': inparam.end
        }
    })
    // 查询局表
    let [err2, ret2] = await new StatRoundModel().query({
        IndexName: 'UserNameIndex',
        KeyConditionExpression: '#userName = :userName AND createdAt between :createdAt0 and :createdAt1',
        ProjectionExpression: '#content,businessKey,winloseAmount',
        FilterExpression: 'gameType = :gameType',
        ExpressionAttributeNames: {
            '#userName': 'userName',
            '#content': 'content'
        },
        ExpressionAttributeValues: {
            ':userName': inparam.userName,
            ':gameType': inparam.gameType,
            ':createdAt0': inparam.start,
            ':createdAt1': inparam.end
        }
    })
    // 流水数据汇总
    for (let item of ret.Items) {
        if (!repeatMap[item.txnid]) {
            repeatMap[item.txnid] = true
        } else {
            console.log(`重复：${item.txnid}  ${item.sn}`)
        }
        winloseAmount += item.amount
        bkCountMap[item.businessKey] = true
        if (item.type == 3) {
            billBetCount++
            billArr.push(item.sn)
        }
    }
    for (let key in bkCountMap) {
        bkCount++
    }
    // 局表数据汇总
    for (let round of ret2.Items) {
        roundBetCount += round.content.bet.length
        for (let bet of round.content.bet) {
            roundArr.push(bet.sn)
        }
    }
    console.log(`流水总数：${ret.Items.length}`)
    console.log(`局总数：${bkCount}`)
    console.log(`输赢金额：${winloseAmount}`)
    console.log(`流水下注总数：${billBetCount}`)
    console.log(`局表下注总数：${roundBetCount}`)
    let roundBillArr = _.difference(roundArr, billArr)
    let billRoundArr = _.difference(billArr, roundArr)
    console.log('下面是差异的的流水')
    console.log(roundBillArr)
    console.log(billRoundArr)
    // console.log('流水下注')
    // console.log(JSON.stringify(billArr))
    // console.log('局表下注')
    // console.log(JSON.stringify(roundArr))
    ctx.body = { code: 0, msg: 'Y', payload: { roundBillArr, billRoundArr } }
})

/**
 * 修正时间段的战绩表与交易记录的下注时间，使其保证一致
 * @param {*} start 起始时间
 * @param {*} end 结束时间
 * @param {*} userName 可选，玩家帐号（只修复指定玩家）
 * 战绩表 parentIdIndex
 * 局表 ParentIndex
 */
router.post('/stat/fixRecrodRound', async function (ctx, next) {
    const inparam = ctx.request.body
    let gameRecordModel = new HeraGameRecordModel()
    let statRound = new StatRoundModel()
    let notFindBk = [], fixTimeBk = [], i = 1
    //获取平台所有商户和代理
    let [userErr, allUsers] = await new BaseModel().scan({
        TableName: Tables.ZeusPlatformUser,
        FilterExpression: "(#role = :role1 OR #role = :role2) AND levelIndex <> :levelIndex AND isTest <> :isTest",
        ProjectionExpression: 'userId,#role',
        ExpressionAttributeNames: {
            '#role': 'role'
        },
        ExpressionAttributeValues: {
            ':role1': '100',
            ':role2': '1000',
            ':levelIndex': '0',
            ':isTest': 1
        }
    })
    console.log(`总共需要处理的用户有${allUsers.Items.length}个`)
    //所有商户和代理，时间范围内的战绩数据
    let promiseAll = []
    for (let user of allUsers.Items) {
        let p = new Promise(async (resolve, reject) => {
            let records = await gameRecordModel.getTimeRecord(user.userId, inparam)
            let rounds = await statRound.getBkInfo({ parent: user.userId, start: inparam.start - 3 * 86400000, end: inparam.end + 3 * 86400000 })
            // 遍历每条战绩，和交易记录对比
            for (let item of records) {
                let roundRes = _.find(rounds, function (o) { return o.businessKey == item.betId })
                // 找到交易，更新战绩的下注时间
                if (roundRes) {
                    if (roundRes.createdAt != item.betTime) {
                        if (!item.record) {
                            console.error(`存在没有record的战绩：${item.userName}，${item.betId}`)
                        } else {
                            item.record.betTime = roundRes.createdAt
                            let upadetParms = {
                                userName: item.userName,
                                betId: item.betId,
                                betTime: roundRes.createdAt,
                                record: item.record
                            }
                            gameRecordModel.updateTimeRecord(upadetParms)
                            console.log(`用户${user.userId}进行战绩修复`)
                            fixTimeBk.push(item.betId)
                        }
                    }
                }
                // 没找到交易，则删除战绩
                else {
                    console.info(`${item.betId}进行再查询`)
                    let bkRes = await statRound.getBkInfo({ bk: item.betId })
                    if (!bkRes[0]) {
                        notFindBk.push({ userName: item.userName, betId: item.betId })
                        // gameRecordModel.deleteItem({
                        //     Key: {
                        //         'userName': item.userName,
                        //         'betId': item.betId
                        //     }
                        // })
                    }
                }
            }
            console.log(`进度：${i++}`)
            resolve(1)
        })
        promiseAll.push(p)
    }
    //并发执行
    await Promise.all(promiseAll)
    console.log(`战绩未查询到交易记录的有${notFindBk.length}条，修复的战绩有${fixTimeBk.length}条`)
    if (notFindBk.length) {
        console.log('没有找到相同战绩的数组')
        console.log(JSON.stringify(notFindBk))
    }
})

/**
 * 检查所有子孙关系
 */
router.post('/stat/checkSubuser', async function (ctx, next) {
    // 入参转换
    const inparam = ctx.request.body
    // 所有测试号
    let [err, res] = await new UserModel().scan({
        ProjectionExpression: 'userId',
        FilterExpression: 'isTest=:isTest',
        ExpressionAttributeValues: {
            ':isTest': 1
        }
    })
    // 遍历每个测试号的所有子孙
    for (let item of res.Items) {
        let [subUserRes, subUserErr] = await new UserModel().scan({
            ProjectionExpression: 'userId',
            FilterExpression: 'contains(levelIndex,:levelIndex) AND isTest <> :isTest',
            ExpressionAttributeValues: {
                ':levelIndex': item.userId,
                ':isTest': 1
            }
        })
        if (subUserRes.Items && subUserRes.Items.length > 0) {
            console.log(`不通过：${item.userId}`)
        } else {
            console.log(`通过：${item.userId}`)
        }
    }
    ctx.body = { code: 0, msg: 'Y' }
})

// /**
//  * 检查战绩gameId
//  */
// router.post('/stat/checkGameId', async function (ctx, next) {
//     // 入参转换
//     const inparam = ctx.request.body
//     let [err, res] = await new HeraGameRecordModel().query({
//         IndexName: 'parentIdIndex',
//         KeyConditionExpression: 'parentId=:parentId AND betTime between :createdAt0 and :createdAt1',
//         ProjectionExpression: 'userName,betId',
//         FilterExpression: 'gameId=:gameId',
//         ExpressionAttributeValues: {
//             ':parentId': inparam.parentId,
//             ':gameId': '1',
//             ':createdAt0': 1535299200000,
//             ':createdAt1': 1535451780000
//         }
//     })
//     for (let item of res.Items) {
//         await new HeraGameRecordModel().updateItem({
//             Key: { userName: item.userName, betId: item.betId },
//             UpdateExpression: 'SET gameId = :gameId',
//             ExpressionAttributeValues: {
//                 ':gameId': '30001'
//             }
//         })
//     }
//     ctx.body = { code: 0, msg: 'Y' }
// })

module.exports = router