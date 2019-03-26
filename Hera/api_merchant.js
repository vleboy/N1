//工具
import { JSONParser } from './libs/JSONParser'
import { ResOK, ResFail } from './libs/Response'
import { BillCheck } from './libs/BillCheck'
const _ = require('lodash')
const axios = require('axios')
const uuid = require('uuid/v4')
const NP = require('number-precision')
import jwt from 'jsonwebtoken'
//model
const UserModel = require('./models/UserModel')
const LogModel = require('./models/LogModel')
const HeraGameRecordModel = require('./models/HeraGameRecordModel')
const gameRecordUtil = require('./libs/gameRecordUtil')
const MerchantBillModel = require('./models/MerchantBillModel')
const PlayerModel = require('./models/PlayerModel')
const IPCheck = require('./libs/IPCheck')
//常量
const TOKEN_SECRET = process.env.TOKEN_SECRET

/**
 * 商户分页查询获取游戏战绩
 */
async function gameRecordPage(e, c, cb) {
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
            keys = {
                parentId: userInfo.userId,
                createdAt: { "$range": [+inparam.startTime, +inparam.endTime] }
            }
        }
        // 按照下注时间查询
        else {
            keys = {
                parentId: userInfo.userId,
                betTime: { "$range": [+inparam.startTime, +inparam.endTime] }
            }
        }
        //5,查询数据
        let [records, islastKey] = await new HeraGameRecordModel().queryParms(indexName, keys, queryParms, inparam)
        //6,组装返回的数据结构
        let page = {
            pageSize: records.length,
            list: [],
            lastKey: ''
        }
        // 组装page.list
        // if (records.length > 0) {
        //     records.forEach((item, index) => {
        //         page.list[index] = records[index].record
        //         page.list[index].gameType = records[index].gameType
        //         page.list[index].gameId = records[index].gameId
        //         page.list[index].userId = records[index].userId
        //         page.list[index].userName = records[index].userName
        //         page.list[index].betTime = records[index].betTime
        //         page.list[index].createdAt = records[index].createdAt
        //     })
        // }
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
        let data = {}
        data.body = e.body
        data.userId = 'NULL!'
        data.userName = 'NULL!'
        data.err = err
        new LogModel().add('2', 'gameRecordPage', data, `查询战绩出错`)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * 商户对玩家的操作
 */
async function merchantPlayer(e, c, cb) {
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
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        //4,根据不同操作标识，处理相关逻辑
        let names = []  //玩家账号数组
        let userName = '' //玩家用户名
        switch (inparam.method) {
            case 'QUERY_PLAYER_BALANCE': //查询玩家余额
                if (typeof inparam.names != 'object' || inparam.names.length == 0) {
                    return ResFail(cb, { msg: 'names的参数不合法' }, 900)
                }
                names = inparam.names.map((item) => {
                    return `${userInfo.suffix}_${item}`
                })
                let balanceArr = await new PlayerModel().queryNamesBalance(names)
                return ResOK(cb, { msg: 'success', data: balanceArr }, 0)
                break;
            case 'CHANGE_PLAYER_PASSWORD'://改变玩家密码
                if (!inparam.userName || !inparam.userPwd) {
                    return ResFail(cb, { msg: '请检查你的入参' }, 900)
                }
                userName = `${userInfo.suffix}_${inparam.userName}`
                //查询玩家是否存在
                await new PlayerModel().getPlayer(userName)
                //更新玩家
                await new PlayerModel().updatePwd({ userName, newPwd: inparam.userPwd })
                return ResOK(cb, { msg: 'success' }, 0)
                break;
            case 'OPERATE_PLAYER_BALANCE'://玩家存提点操作
                if (!inparam.userName || !inparam.action || !inparam.amount) {
                    return ResFail(cb, { msg: '请检查你的入参' }, 900)
                }
                if (inparam.action != 1 && inparam.action != -1) {
                    return ResFail(cb, { msg: '请检查你的入参' }, 900)
                }
                //玩家操作的金额小数点两位处理
                inparam.amount = NP.round(inparam.amount, 2)
                userName = `${userInfo.suffix}_${inparam.userName}`
                //5,获取玩家信息，并验证
                const playerModel = new PlayerModel()
                let playerInfo = await playerModel.getPlayer(userName)
                if (playerInfo.state == '0') {
                    return ResFail(cb, { msg: '玩家已被冻结' }, 10006)
                }
                if (playerInfo.gameState == 3) { //游戏中
                    if (+playerInfo.gameId >= 1000000) {
                        //更新玩家状态（第三方游戏网页中或强制离线后操作）
                        await playerModel.updateOffline(userName)
                    } else {
                        return ResFail(cb, { msg: '玩家在游戏中不能进行充值和提现操作' }, 11001)
                    }
                }
                //6,根据不同的操作类型（充值或提现）有不同的处理
                let usage = inparam.action == -1 ? 'billout' : 'billin' // 提现需要检查余额绝对正确
                let palyerBalance = await playerModel.getNewBalance({ userName: playerInfo.userName, userId: playerInfo.userId, balance: playerInfo.balance, usage })
                if (palyerBalance == 'err') {
                    return ResFail(cb, { msg: '账务正在结算中，请联系管理员' }, 500)
                }
                if (inparam.action == 1) { //充值操作
                    //获取商户的点数并检查商户的点数是否足够
                    let userBalance = await new MerchantBillModel().queryUserBalance(userInfo.userId)
                    if (userBalance < +inparam.amount) {
                        return ResFail(cb, { msg: '商户余额不足' }, 500)
                    }
                } else if (inparam.action == -1) { //提现操作
                    //检查玩家的点数是否足够
                    if (palyerBalance < +inparam.amount) {
                        return ResFail(cb, { msg: '提现金额大于账户余额' }, 500)
                    }
                }
                //7,更新玩家余额，并推送大厅
                let updateBalance = {
                    userName: playerInfo.userName,
                    userId: playerInfo.userId,
                    amt: action == 1 ? Math.abs(+inparam.amount) : Math.abs(+inparam.amount) * -1
                }
                let currentBalanceObj = await playerModel.updatePlayerBalance(updateBalance)
                //8,写入用户流水表
                let userBill = {
                    sn: uuid(),
                    fromRole: action == 1 ? '100' : '10000',  //如果是充值则
                    toRole: action == 1 ? '10000' : '100',
                    fromUser: action == 1 ? userInfo.username : userName,
                    toUser: action == 1 ? userName : userInfo.username,
                    amount: action == 1 ? Math.abs(+inparam.amount) * -1 : Math.abs(+inparam.amount),
                    operator: userName,
                    remark: action > 0 ? "中心钱包转入" : "中心钱包转出",
                    // gameType: -1,
                    typeName: "中心钱包",
                    username: userInfo.username,
                    userId: userInfo.userId,
                    fromLevel: userInfo.level,
                    fromDisplayName: playerInfo.userName,
                    toDisplayName: playerInfo.userName,
                    toLevel: 10000,
                    action: -action
                }
                //9,写入玩家流水表
                let playerBill = {
                    sn: uuid(),
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
                break;
            case 'OPERATE_PLAYER_FORZEN'://冻结|解冻玩家
                if (typeof inparam.names != 'object' || inparam.names.length == 0) {
                    return ResFail(cb, { msg: 'names的参数不合法' }, 900)
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
                break;
            case 'QUERY_MERCHANT_INFO'://获取商户信息
                let merchantBalance = await new MerchantBillModel().queryUserBalance(userInfo.userId)
                let data = {
                    displayId: inparam.buId,
                    displayName: userInfo.displayName,
                    feedbackURL: userInfo.feedbackURL,
                    frontURL: userInfo.frontURL,
                    gameList: userInfo.gameList,
                    isOpenBrowser: userInfo.isOpenBrowser,
                    launchImg: userInfo.launchImg,
                    loginWhiteList: userInfo.loginWhiteList,
                    moneyURL: userInfo.moneyURL,
                    msn: userInfo.msn,
                    registerURL: userInfo.registerURL,
                    sn: userInfo.sn,
                    suffix: userInfo.suffix,
                    uname: userInfo.uname,
                    username: userInfo.username,
                    userId: userInfo.userId,
                    balance: merchantBalance
                }
                return ResOK(cb, { msg: 'success', data }, 0)
                break;
        }
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * 商户报表
 */
async function gameReportByMerchant(e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkgGameReport(inparam)
        //3,获取商户信息，检查密钥是否正确
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
            return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
        }
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        let { apiKey, gameType, startTime, endTime } = inparam
        let domain = 'n1admin.na12345.com'
        if (process.env.NA_CENTER != '47.74.152.121') {
            domain = 'd3rqtlfdd4m9wd.cloudfront.net'
        }
        let res = await axios.post(`https://${domain}/externUserStat`, {
            apiKey, gameType, role: '100', userIds: [userInfo.userId], query: { createdAt: [startTime, endTime] }
        })
        return ResOK(cb, { msg: 'success', data: (res.data.payload || [])[0] }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * 商户玩家报表
 */
async function gameReportByPlayer(e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkgGameReport(inparam)
        //3,获取商户信息，检查密钥是否正确
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
            return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
        }
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        let playerres = await new PlayerModel().query({
            IndexName: 'parentIdIndex',
            KeyConditionExpression: 'parent = :parent',
            ProjectionExpression: 'userName',
            ExpressionAttributeValues: {
                ':parent': userInfo.userId
            }
        })
        let gameUserNames = playerres.Items.map((item) => item.userName)
        let { apiKey, gameType, startTime, endTime } = inparam
        let domain = 'n1admin.na12345.com'
        if (process.env.NA_CENTER != '47.74.152.121') {
            domain = 'd3rqtlfdd4m9wd.cloudfront.net'
        }
        let res = await axios.post(`https://${domain}/externPlayerStat`, {
            apiKey, gameUserNames, gameType, query: { createdAt: [startTime, endTime] }
        })
        for (let item of res.data.payload) {
            item.userName = item.userName.slice(item.userName.indexOf('_') + 1)
        }
        return ResOK(cb, { msg: 'success', data: res.data.payload || [] }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}
/**
 *  校验玩家token，用于充值页面打开免账号登录
 */
async function validateToken(e, c, cb) {
    try {
        //1,获取入参
        let inparam = JSONParser(e.body)
        //2,参数校验
        // new BillCheck().checkPlayerToken(inparam)
        const tokenInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
        if (!tokenInfo || inparam.userName != tokenInfo.userName) {
            return ResFail(cb, { msg: 'token校验失败' }, 11000)
        }
        return ResOK(cb, { msg: 'success' }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

export {
    gameRecordPage,                   //商户查询战绩
    merchantPlayer,                   //商户对玩家的操作
    validateToken,                    //玩家的token验证
    gameReportByMerchant,             //商户报表
    gameReportByPlayer                //商户玩家报表
}