//工具
const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const BillCheck = require('./libs/BillCheck')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
// const crypto = require('crypto')
//model
const PlayerModel = require('./models/PlayerModel')
const UserModel = require('./models/UserModel')
const IPCheck = require('./libs/IPCheck')
const GameStateEnum = require('./libs/Dynamo').GameStateEnum
//常量
const TOKEN_SECRET = process.env.TOKEN_SECRET

/**
 * 玩家注册
 */
module.exports.gamePlayerRegister = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkPlayerRegister(inparam)
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
        //4,检验玩家是否存在
        let userName = `${userInfo.suffix}_${inparam.userName}`
        let playerInfo = await new PlayerModel().getPlayerByUserName(userName)
        // 玩家已经存在，检查是否需要更新昵称
        if (!_.isEmpty(playerInfo)) {
            if (inparam.nickname) {
                if (inparam.nickname != playerInfo.nickname) {
                    let checkNicknameRes = await new PlayerModel().checkNickname(userInfo.userId, inparam.nickname)
                    if (checkNicknameRes.Items.length == 0) {
                        await new PlayerModel().updateNickname(userName, inparam.nickname)
                        return ResOK(cb, { msg: 'success' }, 0)
                    } else {
                        return ResFail(cb, { msg: '昵称已存在' }, 10013)
                    }
                } else {
                    return ResFail(cb, { msg: '昵称已存在' }, 10013)
                }
            } else {
                return ResFail(cb, { msg: '玩家已存在' }, 10003)
            }
        }
        // 新创建的玩家，检查昵称是否重复
        else if (inparam.nickname) {
            if (!inparam.userPwd) {
                return ResFail(cb, { msg: '请求参数userPwd错误' }, 500)
            }
            let checkNicknameRes = await new PlayerModel().checkNickname(userInfo.userId, inparam.nickname)
            if (checkNicknameRes.Items.length > 0) {
                return ResFail(cb, { msg: '昵称已存在' }, 10013)
            }
        }
        //生成玩家的userId
        let userId = _.random(100000, 999999)
        while (await new PlayerModel().isUserIdExit(userId)) {
            userId = _.random(100000, 999999)
        }
        await new PlayerModel().putItem({
            userName,
            userId,
            password: inparam.userPwd,
            buId: inparam.buId,
            role: 10000,
            state: 1,
            balance: 0,
            msn: _.padStart(userInfo.msn, 3, '0'),
            merchantName: userInfo.displayName,
            parent: userInfo.userId,
            parentName: userInfo.username,
            nickname: inparam.nickname || 'NULL!',
            gameState: GameStateEnum.OffLine,
            parentSn: userInfo.sn
        })
        return ResOK(cb, { msg: 'success' }, 0)
    } catch (err) {
        console.error(err)
        let code = err == '非法IP' ? 10002 : 500
        return ResFail(cb, { msg: err }, code)
    }
}

/**
 * 玩家获取token(废弃)
 */
module.exports.playerLoginToken = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkPlayerLoginToken(inparam)
        //3,获取商户信息
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo) || userInfo.apiKey != inparam.apiKey) {
            return ResFail(cb, { msg: '商户不存在,请检查buId和apiKey' }, 10001)
        }
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        if (userInfo.role != '100') {
            return ResFail(cb, { msg: '非法身份' }, 500)
        }
        if (userInfo.status == '0') {
            return ResFail(cb, { msg: '商户已停用' }, 10006)
        }
        //4,获取玩家信息
        let userName = `${userInfo.suffix}_${inparam.userName}`
        let playerInfo = await new PlayerModel().getPlayer(userName)
        if (playerInfo.state == 0) {
            return ResFail(cb, { msg: '玩家已启用' }, 10005)
        }
        if (playerInfo.password != inparam.userPwd) {
            return ResFail(cb, { msg: '玩家密码不正确' }, 10004)
        }
        //5,生成token返回
        let loginToken = jwt.sign({ userName, suffix: userInfo.suffix, userId: +playerInfo.userId, exp: Math.floor(Date.now() / 1000) + 86400 }, TOKEN_SECRET)
        let data = {
            token: loginToken,
            userName: playerInfo.userName,
            userId: playerInfo.userId
        }
        return ResOK(cb, { msg: 'success', data: data }, 0)
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

/**
 * 玩家获取自己的余额(废弃)
 */
module.exports.getGamePlayerBalance = async function (e, c, cb) {
    try {
        //1,获取入参
        let userName = decodeURI(e.pathParameters.userName)
        //2,token校验
        let tokenInfo = {}
        try {
            tokenInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
        } catch (err) {
            return ResFail(cb, { msg: 'token验证失败或过期' }, 10010)
        }
        if (!tokenInfo || !Object.is(`${tokenInfo.suffix}_${userName}`, tokenInfo.userName)) {
            return ResFail(cb, { msg: 'token验证失败或过期' }, 10010)
        }
        userName = `${tokenInfo.suffix}_${userName}`
        const inparam = JSONParser(e.queryStringParameters || {})
        //3,参数校验
        new BillCheck().checkPlayerBalance(inparam)
        //4,获取商户信息
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo)) {
            return ResFail(cb, { msg: '商户不存在' }, 10011)
        }
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        //7,获取玩家余额
        let playerInfo = await new PlayerModel().getPlayer(userName)
        let usage = 'getGamePlayerBalance'
        let balance = await new PlayerModel().getNewBalance({ userName, userId: playerInfo.userId, balance: playerInfo.balance, usage })
        return ResOK(cb, { msg: 'success', data: { balance } }, 0)
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