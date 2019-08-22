const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const BillCheck = require('./libs/BillCheck')
const _ = require('lodash')
const uuid = require('uuid/v4')
const NP = require('number-precision')
// const axios = require('axios')
// const jwt = require('jsonwebtoken')
const UserModel = require('./models/UserModel')
const LogModel = require('./models/LogModel')
const HeraGameRecordModel = require('./models/HeraGameRecordModel')
const gameRecordUtil = require('./libs/gameRecordUtil')
const MerchantBillModel = require('./models/MerchantBillModel')
const PlayerBillDetailModel = require('./models/PlayerBillDetailModel')
const PlayerModel = require('./models/PlayerModel')
const IPCheck = require('./libs/IPCheck')
const GameStateEnum = require('./libs/Dynamo').GameStateEnum
//常量
// const TOKEN_SECRET = process.env.TOKEN_SECRET

/**
 * 商户分页查询获取游戏战绩
 */
module.exports.gameRecordPage = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkGameRecord(inparam)
        //3,获取商户信息，检查密钥是否正确
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
            return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
        }
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        //4,组装判断查询条件
        let queryParms = {}                                                                      //查询的条件
        let keys = {}                                                                            //查询分区键
        let indexName = inparam.queryType == 1 ? "parentIdCreatedAtIndex" : "parentIdIndex"      //设置查询索引
        inparam.userName ? queryParms.userName = `${userInfo.suffix}_${inparam.userName}` : null //设置玩家帐号
        inparam.gameType ? queryParms.gameType = +inparam.gameType : null                        //设置查询游戏大类
        if (inparam.gameId) {
            queryParms.gameId = inparam.gameId.toString()                                        //gameId存在就删掉gameType
            delete queryParms.gameType
        }
        if (inparam.lastKey && typeof inparam.lastKey == 'string') {
            inparam.lastKey = JSON.parse(inparam.lastKey)                                        //设置查询起始key
        }
        // 按照创建时间查询
        if (inparam.queryType == 1) {
            keys = { parentId: userInfo.userId, createdAt: { "$range": [+inparam.startTime, +inparam.endTime] } }
        }
        // 按照下注时间查询
        else {
            keys = { parentId: userInfo.userId, betTime: { "$range": [+inparam.startTime, +inparam.endTime] } }
        }
        //5,查询数据
        let [records, islastKey] = await new HeraGameRecordModel().queryParms(indexName, keys, queryParms, inparam)
        //6,组装返回的数据结构
        let page = {
            pageSize: records.length,
            list: [],
            lastKey: ''
        }
        for (let record of records) {
            let subRecord = record.record && typeof record.record == 'object' ? record.record : {}
            record = { ...subRecord, ...record }
            delete record.record
            page.list.push(record)
        }
        // 获取最后一条数据的主分区和索引键，作为下一次查询的起始
        if (islastKey) {
            let lastRecord = records[records.length - 1]
            if (lastRecord) {
                let lastKey = {
                    userName: lastRecord.userName,
                    betId: lastRecord.betId,
                    parentId: lastRecord.parentId,
                    betTime: lastRecord.betTime
                }
                if (inparam.queryType == 1) {
                    lastKey.createdAt = lastRecord.createdAt
                    delete lastKey.betTime
                }
                page.lastKey = JSON.stringify(lastKey)
            }
        }
        //7,根据不同游戏解析数据
        gameRecordUtil.buildNewPageRows(page)
        //返回结果
        return ResOK(cb, { msg: 'success', page }, 0)
    } catch (err) {
        console.error(err)
        let code = err == '非法IP' ? 10002 : 500
        let data = {}
        data.body = e.body
        data.userId = 'NULL!'
        data.userName = 'NULL!'
        data.err = err
        new LogModel().add('2', 'gameRecordPage', data, `查询战绩出错`)
        return ResFail(cb, { msg: err }, code)
    }
}

/**
 * 商户对玩家的操作
 */
module.exports.merchantPlayer = async function (e, c, cb) {
    try {
        //1,获取入参
        let inparam = JSONParser(e.body)
        let action = inparam.action
        //2,参数校验
        new BillCheck().checkMerchantPlayer(inparam)
        //3,获取商户信息
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
            return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
        }
        if (userInfo.status == 0) {
            return ResFail(cb, { msg: '商户已停用' }, 10006)
        }
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        //4,根据不同操作标识，处理相关逻辑
        let names = []  //玩家账号数组
        let userName = '' //玩家用户名
        switch (inparam.method) {
            case 'QUERY_PLAYER_BALANCE': //查询玩家余额
                if (typeof inparam.names != 'object' || inparam.names.length == 0) {
                    return ResFail(cb, { msg: '参数names不合法' }, 500)
                }
                names = inparam.names.map((item) => {
                    return `${userInfo.suffix}_${item}`
                })
                let balanceArr = await new PlayerModel().queryNamesBalance(names)
                return ResOK(cb, { msg: 'success', data: balanceArr }, 0)
            case 'CHANGE_PLAYER_PASSWORD'://改变玩家密码
                if (!inparam.userName || !inparam.userPwd) {
                    return ResFail(cb, { msg: '请检查入参' }, 500)
                }
                userName = `${userInfo.suffix}_${inparam.userName}`
                //查询玩家是否存在
                await new PlayerModel().getPlayer(userName)
                //更新玩家
                await new PlayerModel().updatePwd({ userName, newPwd: inparam.userPwd })
                return ResOK(cb, { msg: 'success' }, 0)
            case 'OPERATE_PLAYER_BALANCE'://玩家存提点操作
                if (!inparam.userName || !inparam.action || !inparam.amount) {
                    return ResFail(cb, { msg: '请检查入参' }, 500)
                }
                if (inparam.action != 1 && inparam.action != -1) {
                    return ResFail(cb, { msg: '请检查入参' }, 500)
                }
                //玩家操作的金额小数点两位处理
                inparam.amount = NP.round(+inparam.amount, 2)
                userName = `${userInfo.suffix}_${inparam.userName}`
                //获取玩家信息，并验证
                const playerModel = new PlayerModel()
                let playerInfo = await playerModel.getPlayer(userName)
                if (playerInfo.state == '0') {
                    return ResFail(cb, { msg: '玩家已停用' }, 10005)
                }
                if (inparam.action == -1 && playerInfo.gameState != GameStateEnum.OffLine) {
                    await playerModel.updateOffline(userName)
                }
                //充值，检查商户余额
                if (inparam.action == 1) {
                    let userBalance = await new MerchantBillModel().queryUserBalance(userInfo.userId)
                    if (userBalance < inparam.amount) {
                        return ResFail(cb, { msg: '商户余额不足' }, 10008)
                    }
                }
                //提现，检查玩家余额
                else if (inparam.action == -1) {
                    let usage = inparam.action == -1 ? 'billout' : 'billin'
                    let palyerBalance = await playerModel.getNewBalance({ userName: playerInfo.userName, userId: playerInfo.userId, balance: playerInfo.balance, usage })
                    if (palyerBalance == 'err') {
                        return ResFail(cb, { msg: '账务正在结算中，请联系管理员' }, 500)
                    }
                    if (palyerBalance < inparam.amount) {
                        return ResFail(cb, { msg: '玩家提现金额大于账户余额' }, 10009)
                    }
                }
                //如果使用自定义SN，需要检查是否重复
                let playerBillSn = uuid()
                if (inparam.sn) {
                    if (!_.startsWith(inparam.sn, `${inparam.buId}_${inparam.userName}_`)) {
                        return ResFail(cb, { msg: '流水号SN格式不正确' }, 10014)
                    }
                    let snRes = await new PlayerBillDetailModel().getBill(inparam.sn)
                    if (snRes && snRes.Item && !_.isEmpty(snRes.Item)) {
                        return ResFail(cb, { msg: '流水号SN已存在' }, 10015)
                    } else {
                        playerBillSn = inparam.sn
                    }
                }
                //更新玩家余额
                let updateBalance = {
                    userName: playerInfo.userName,
                    userId: playerInfo.userId,
                    amt: action == 1 ? Math.abs(inparam.amount) : Math.abs(inparam.amount) * -1
                }
                let currentBalanceObj = await playerModel.updatePlayerBalance(updateBalance)
                //写入用户流水表
                let userBill = {
                    sn: uuid(),
                    fromRole: action == 1 ? '100' : '10000',
                    toRole: action == 1 ? '10000' : '100',
                    fromUser: action == 1 ? userInfo.username : userName,
                    toUser: action == 1 ? userName : userInfo.username,
                    amount: action == 1 ? Math.abs(inparam.amount) * -1 : Math.abs(inparam.amount),
                    operator: userName,
                    remark: action == 1 ? "中心钱包转入" : "中心钱包转出",
                    typeName: "中心钱包",
                    username: userInfo.username,
                    userId: userInfo.userId,
                    fromLevel: userInfo.level,
                    fromDisplayName: action == 1 ? userInfo.displayName : userName,
                    toDisplayName: action == 1 ? userName : userInfo.displayName,
                    action: -action
                }
                //写入玩家流水表
                let playerBill = {
                    sn: playerBillSn,
                    action: action,
                    type: 11,  //中心钱包
                    gameType: 1,
                    userId: playerInfo.userId,
                    userName: playerInfo.userName,
                    parent: playerInfo.parent,
                    originalAmount: currentBalanceObj.originalAmount,
                    amount: currentBalanceObj.amount,
                    balance: currentBalanceObj.balance
                }
                await new MerchantBillModel().playerBillTransfer(userBill, playerBill)
                return ResOK(cb, { msg: 'success', data: { balance: currentBalanceObj.balance } }, 0)
            case 'OPERATE_PLAYER_FORZEN'://冻结|解冻玩家
                if (typeof inparam.names != 'object' || inparam.names.length == 0) {
                    return ResFail(cb, { msg: '参数names不合法' }, 500)
                }
                let state = inparam.state || 0
                if (state != 0 && state != 1) {
                    state = 0
                }
                names = inparam.names.map((item) => {
                    return `${userInfo.suffix}_${item}`
                })
                await new PlayerModel().updateNameState(names, state)
                return ResOK(cb, { msg: 'success', state }, 0)
            case 'QUERY_PLAYER_SN': //根据sn查询流水
                if (!inparam.sn) {
                    return ResFail(cb, { msg: '请检查入参' }, 500)
                }
                let isExist = false
                let snRes = await new PlayerBillDetailModel().getBill(inparam.sn)
                if (snRes && snRes.Item && !_.isEmpty(snRes.Item)) {
                    isExist = true
                }
                return ResOK(cb, { msg: 'success', isExist }, 0)
            case 'QUERY_MERCHANT_INFO'://获取商户信息
                let merchantBalance = await new MerchantBillModel().queryUserBalance(userInfo.userId)
                let data = {
                    displayId: inparam.buId,
                    displayName: userInfo.displayName,
                    gameList: userInfo.gameList,
                    loginWhiteList: userInfo.loginWhiteList,
                    sn: userInfo.sn,
                    suffix: userInfo.suffix,
                    uname: userInfo.uname,
                    username: userInfo.username,
                    balance: merchantBalance
                }
                return ResOK(cb, { msg: 'success', data }, 0)
            default:
                return ResOK(cb, { msg: '参数 method 错误' }, 500)
        }
    } catch (err) {
        console.error(err)
        let code = err == '非法IP' ? 10002 : 500
        if (err.code == -1) {
            code = 10012
            err = '玩家不存在'
        }
        return ResFail(cb, { msg: err }, code)
    }
}

// /**
//  * 商户报表
//  */
// module.exports.gameReportByMerchant = async function (e, c, cb) {
//     try {
//         //1,获取入参
//         const inparam = JSONParser(e.body)
//         console.log(inparam)
//         //2,参数校验
//         new BillCheck().checkgGameReport(inparam)
//         //3,获取商户信息，检查密钥是否正确
//         let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
//         if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
//             return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
//         }
//         //ip校验
//         new IPCheck().validateIP(e, userInfo)
//         let { apiKey, gameType, startTime, endTime } = inparam
//         let domain = 'n1admin.na12345.com'
//         if (process.env.NA_CENTER != '47.74.152.121') {
//             domain = 'd3rqtlfdd4m9wd.cloudfront.net'
//         }
//         let res = await axios.post(`https://${domain}/externUserStat`, {
//             apiKey, gameType, role: '100', userIds: [userInfo.userId], query: { createdAt: [startTime, endTime] }
//         })
//         return ResOK(cb, { msg: 'success', data: (res.data.payload || [])[0] }, 0)
//     } catch (err) {
//         console.error(err)
//         let code = err == '非法IP' ? 10002 : 500
//         return ResFail(cb, { msg: err }, code)
//     }
// }

// /**
//  * 商户玩家报表
//  */
// module.exports.gameReportByPlayer = async function (e, c, cb) {
//     try {
//         //1,获取入参
//         const inparam = JSONParser(e.body)
//         console.log(inparam)
//         //2,参数校验
//         new BillCheck().checkgGameReport(inparam)
//         //3,获取商户信息，检查密钥是否正确
//         let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
//         if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
//             return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
//         }
//         //ip校验
//         new IPCheck().validateIP(e, userInfo)
//         let playerres = await new PlayerModel().query({
//             IndexName: 'parentIdIndex',
//             KeyConditionExpression: 'parent = :parent',
//             ProjectionExpression: 'userName',
//             ExpressionAttributeValues: {
//                 ':parent': userInfo.userId
//             }
//         })
//         let gameUserNames = playerres.Items.map((item) => item.userName)
//         let { apiKey, gameType, startTime, endTime } = inparam
//         let domain = 'n1admin.na12345.com'
//         if (process.env.NA_CENTER != '47.74.152.121') {
//             domain = 'd3rqtlfdd4m9wd.cloudfront.net'
//         }
//         let res = await axios.post(`https://${domain}/externPlayerStat`, {
//             apiKey, gameUserNames, gameType, query: { createdAt: [startTime, endTime] }
//         })
//         for (let item of res.data.payload) {
//             item.userName = item.userName.slice(item.userName.indexOf('_') + 1)
//         }
//         return ResOK(cb, { msg: 'success', data: res.data.payload || [] }, 0)
//     } catch (err) {
//         console.error(err)
//         let code = err == '非法IP' ? 10002 : 500
//         return ResFail(cb, { msg: err }, code)
//     }
// }
// /**
//  *  校验玩家token，用于充值页面打开免账号登录
//  */
// module.exports.validateToken = async function (e, c, cb) {
//     try {
//         let inparam = JSONParser(e.body)
//         const tokenInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
//         if (!tokenInfo || inparam.userName != tokenInfo.userName) {
//             return ResFail(cb, { msg: 'token校验失败' }, 10010)
//         }
//         return ResOK(cb, { msg: 'success' }, 0)
//     } catch (err) {
//         console.error(err)
//         return ResFail(cb, { msg: err }, 500)
//     }
// }