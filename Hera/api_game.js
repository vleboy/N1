//工具
const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const BillCheck = require('./libs/BillCheck')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
const moment = require('moment')
//model
const PlayerModel = require('./models/PlayerModel')
const UserModel = require('./models/UserModel')
const SYSTransferModel = require('./models/SYSTransferModel')
const LogModel = require('./models/LogModel')
const GameStateEnum = require('./libs/Dynamo').GameStateEnum
//常量
const TOKEN_SECRET = process.env.TOKEN_SECRET
const COMPANY_NA_KEY = process.env.COMPANY_NA_KEY

/**
 * 网页游戏认证
 */
module.exports.auth = async function (e, c, cb) {
    try {
        //1,获取入参
        console.log(e.body)
        const inparam = JSONParser(e.body)
        //2,参数校验
        if (!inparam.sid) {
            new BillCheck().checkAuth(inparam)
            // 不是NA平台调用
            if (inparam.plat && inparam.plat != 'NA') {
                return transferAuth(inparam, cb)
            }
            //3，签名校验
            let sign = CryptoJS.SHA1(`${inparam.timestamp}${COMPANY_NA_KEY}`).toString(CryptoJS.enc.Hex)
            if (sign != inparam.apiKey) {
                inparam.userName = '签名错误'
                console.log(`原始签名：${inparam.timestamp}${COMPANY_NA_KEY}`)
                console.log(`请求过来的签名：${inparam.apiKey}`)
                console.log(`重新计算的签名：${sign}`)
                new LogModel().add('2', 'signerror', inparam, `apiKey不正确`)
                return ResFail(cb, { msg: 'apiKey不正确' }, 500)
            }
        } else {// 兼容第三方游戏
            inparam.gameType = inparam.gameId
            inparam.gameId = inparam.sid
        }
        //token校验
        if (inparam.token) {
            let tokenInfo = await jwt.verify(inparam.token, TOKEN_SECRET)
            if (inparam.userId != tokenInfo.userId) {
                return ResFail(cb, { msg: 'token无效' }, 500)
            }
        }
        //3,获取玩家信息
        const playerModel = new PlayerModel()
        let player = await playerModel.getPlayerById(inparam.userId)
        if (player.state != 1) {
            return ResFail(cb, { msg: '玩家已停用' }, 10005)
        }
        //4,校验玩家所属商户是否购买此款游戏
        let userInfo = await new UserModel().queryUserById(player.parent)
        if (userInfo.status != 1) {
            return ResFail(cb, { msg: '商户已停用' }, 10006)
        }
        let index = _.findIndex(userInfo.gameList, function (o) { return o.code == inparam.gameType })
        if (index == -1) {
            return ResFail(cb, { msg: '商家暂无此款游戏' }, 11006)
        }
        else {
            let company = userInfo.gameList[index].company
            if (userInfo.companyList && _.find(userInfo.companyList, function (o) { return o.company == company }).status == 0) {
                return ResFail(cb, { msg: '商家游戏已被禁用，请联系运营商' }, 11007)
            }
        }
        //5,从缓存表获取玩家最新余额
        player.usage = 'auth'
        let balance = await playerModel.getNewBalance(player)
        //6,更新玩家，组装更新参数
        let updateParms = {}
        updateParms.gameState = GameStateEnum.GameIng
        updateParms.gameId = inparam.gameType
        updateParms.sid = inparam.gameId
        updateParms.joinTime = Date.now()                        //更新玩家进入游戏时间
        await playerModel.updateJoinGame(player.userName, updateParms)
        return ResOK(cb, { msg: '操作成功', balance: balance, nickname: player.userId, userId: player.userId, isTest: userInfo.isTest, parent: player.parent }, 0)
    } catch (err) {
        if (err && err.name == 'JsonWebTokenError' || err.name == 'TokenExpiredError') {
            return ResFail(cb, { msg: 'token无效或过期' }, 500)
        }
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * NA游戏流水接口
 * plat             平台标识
 * sn               唯一流水号，字符串
 * roundId          大局号（可选），字符串
 * businessKey      回合号（下注和返奖一致），字符串
 * userId           玩家id，数字
 * gameType         游戏大类，数字
 * gameId           具体游戏id，数字
 * billType         流水类型（3下注，4返奖，5返还），数字
 * amt              流水金额（下注为负数，返奖为正数），数字
 * apiKey           接口密钥 SHA1(timestamp+key)
 * 
 * betsn            NA捕鱼和NA街机的退款使用
 * NA街机退款没战绩，自动填充，不持久化
 * NA捕鱼退款没战绩，不判断
 * 
 * NA真人下注返奖一对一，每次批量推送
 */
module.exports.postTransfer = async function (e, c, cb) {
    try {
        //1,获取入参
        console.log(e.body)
        const inparam = JSONParser(e.body)
        if (inparam.plat && inparam.plat != 'NA') {
            return transferNA(inparam, cb)        // 是否进入免转流程
        }
        //2,查询玩家
        const playerModel = new PlayerModel()
        let player = await playerModel.getPlayerById(inparam.userId)
        //3,NA游戏签名校验
        if (inparam.gameType < 1000000) {
            let sign = CryptoJS.SHA1(`${inparam.timestamp}${COMPANY_NA_KEY}`).toString(CryptoJS.enc.Hex)
            if (sign != inparam.apiKey) {
                console.log(`原始签名：${inparam.timestamp}${COMPANY_NA_KEY}，请求过来的签名：${inparam.apiKey}，重新计算的签名：${sign}`)
                inparam.userName = player.userName
                new LogModel().add('2', 'signerror', inparam, `apiKey不正确`)
                return ResFail(cb, { msg: 'apiKey不正确' }, 500)
            }
        }
        //4,exit存在 退出玩家
        if (inparam.exit == 1) {
            if (inparam.gameType != player.gameId) {
                console.error(`玩家当前所在游戏【${player.gameId}】已经没有在所请求的游戏大类【${inparam.gameType}】中`)
                //就算玩家游戏大类不一致也返回成功
                return ResOK(cb, { msg: `玩家当前所在游戏【${player.gameId}】已经没有在所请求的游戏大类【${inparam.gameType}】中` }, 0)
            } else {
                await playerModel.updateOffline(player.userName)
                new LogModel().add('6', 'postTransfer', inparam, `玩家${player.userName}正常退出`)
                return ResOK(cb, { msg: '退出成功', balance: player.balance }, 0)
            }
        }
        //5,参数校验，更新余额
        new BillCheck().check(inparam)
        let amtAfter = await playerModel.updatebalance(player, inparam)
        //6,返回结果
        if (typeof amtAfter == 'object') {
            return ResFail(cb, { msg: amtAfter.msg, balance: player.balance }, amtAfter.code)
        } else {
            console.log({ msg: '同步成功', balance: amtAfter })
            return ResOK(cb, { msg: '同步成功', balance: amtAfter }, 0)
        }
    } catch (err) {
        err = err || '流水接收异常'
        console.error(err)
        if (err && err.code != -1) {
            new LogModel().add('2', 'postTransferError', { userId: 0, userName: '0', body: e.body }, err)
        }
        return ResFail(cb, { msg: err }, 500)
    }
}


//第三方 接入na游戏 内部方法(auth)
async function transferAuth(inparam, cb) {
    //查询标识获取玩家认证
    let userInfo = await new UserModel().queryRolePlat('100', inparam.plat)
    if (_.isEmpty(userInfo)) {
        return ResFail(cb, { msg: '商户未找到' }, 500)
    }
    //校验玩家所属商户是否购买此款游戏
    if (userInfo.status != 1) {
        return ResFail(cb, { msg: '商户已停用' }, 10006)
    }
    let index = _.findIndex(userInfo.gameList, function (o) { return o.code == inparam.gameType })
    if (index == -1) {
        return ResFail(cb, { msg: '商家暂无此款游戏' }, 11006)
    }
    //构造验证参数
    let data = {
        method: 'auth',
        userId: inparam.userId,
        gameId: inparam.gameId,
        timestamp: Date.now()
    }
    data.sign = CryptoJS.SHA1(`${data.gameId}${data.method}${data.timestamp}${data.userId}${userInfo.apiKey}`).toString(CryptoJS.enc.Hex)
    try {
        //请求第三方验证
        let platAuth = await axios.post(userInfo.transferURL, data, { timeout: 10 * 1000 })
        if (platAuth.data.code == 0 && platAuth.data.userNick && !isNaN(parseFloat(platAuth.data.balance))) {
            return ResOK(cb, { msg: '操作成功', balance: parseFloat(platAuth.data.balance.toFixed(2)), nickname: platAuth.data.userNick, userId: inparam.userId }, 0)
        } else {
            return ResFail(cb, { msg: platAuth.data.msg }, platAuth.data.code)
        }
    } catch (error) {
        console.error(error)
        return ResFail(cb, { msg: '认证失败' }, 500)
    }
}

//第三方 接入na游戏 内部方法(bet/win/refund)
async function transferNA(inparam, cb) {
    if (inparam.exit) {
        return ResOK(cb, { msg: '退出成功' }, 0)
    }
    //查询标识获取玩家认证
    let userInfo = await new UserModel().queryRolePlat('100', inparam.plat)
    if (_.isEmpty(userInfo) || !userInfo.transferURL) {
        return ResFail(cb, { msg: '商户未找到或商户未配置免转钱包URL' }, 500)
    }
    //校验玩家所属商户是否购买此款游戏
    if (userInfo.status != 1) {
        return ResFail(cb, { msg: '商户已停用' }, 10006)
    }
    let index = _.findIndex(userInfo.gameList, function (o) { return o.code == inparam.gameType })
    if (index == -1) {
        return ResFail(cb, { msg: '商家暂无此款游戏' }, 11006)
    }
    //查询是否已有相同成功流水
    let detailInfo = await new SYSTransferModel().getBkSN(inparam)
    if (!_.isEmpty(detailInfo)) {
        return ResOK(cb, { msg: `重复流水`, balance: detailInfo.balance }, 0)
    }
    //构造请求参数
    let data = {
        businessKey: inparam.businessKey,
        sn: inparam.sn,
        gameId: inparam.gameId,
        userId: inparam.userId.toString(),
        timestamp: Date.now()
    }
    if (inparam.billType == 3) {
        data.method = 'bet'
        data.amount = Math.abs(inparam.amt) * -1
    } else if (inparam.billType == 4) {
        data.method = 'win'
        data.amount = Math.abs(inparam.amt)
    } else if (inparam.billType == 5) {
        data.method = 'refund'
        data.amount = Math.abs(inparam.amt)
    }
    //签名
    data.sign = CryptoJS.SHA1(`${data.amount}${data.businessKey}${data.gameId}${data.method}${data.sn}${data.timestamp}${data.userId}${userInfo.apiKey}`).toString(CryptoJS.enc.Hex)
    try {
        //请求第三方获取结果
        let platRes = await axios.post(userInfo.transferURL, data, { timeout: 10 * 1000 })
        //构造写入流水数据
        data.userNick = inparam.userNick || data.userId
        data.plat = inparam.plat
        data.anotherGameData = JSON.stringify(inparam)
        data.createdAt = data.timestamp
        data.createdDate = moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD')
        data.createdStr = moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        data.type = inparam.billType
        data.gameType = inparam.gameType
        //成功，失败，超时三种情况
        if (platRes.data.code == 0 && !isNaN(parseFloat(platRes.data.balance))) {
            data.status = 'Y'
            data.balance = parseFloat(platRes.data.balance.toFixed(2))
            await new SYSTransferModel().putItem(data)
            return ResOK(cb, { msg: `操作成功`, balance: data.balance }, 0)
        } else {
            data.status = 'N'
            data.errorMsg = JSON.stringify(platRes.data)
            await new SYSTransferModel().putItem(data)
            return ResFail(cb, { msg: platRes.data.msg, balance: parseFloat(platRes.data.balance.toFixed(2)) }, platRes.data.code)
        }
    } catch (error) {
        data.status = 'E'
        data.userNick = inparam.userNick || data.userId
        data.plat = inparam.plat
        data.anotherGameData = JSON.stringify(inparam)
        data.createdAt = data.timestamp
        data.createdDate = moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD')
        data.createdStr = moment(data.timestamp).utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        data.type = inparam.billType
        data.gameType = inparam.gameType
        await new SYSTransferModel().putItem(data)
        return ResFail(cb, { msg: '推送错误' }, 500)
    }
}

// 私有方法：等待再查询
// function waitASecond(waitTime) {
//     // if (inparam.gameType == 50000 && Date.now() % 2 == 0) {
//     console.log(`等待${waitTime}毫秒后再次查询`)
//     return new Promise((reslove, reject) => {
//         setTimeout(function () { reslove('Y') }, waitTime)
//     })
//     // }
// }

// export {
//     auth,                            //网页游戏认证
//     postTransfer                     //玩家下注返奖流水记录
// }