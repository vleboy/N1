//工具
const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
//model
const PlayerModel = require('./models/PlayerModel')
const UserModel = require('./models/UserModel')
const GameStateEnum = require('./libs/Dynamo').GameStateEnum
//常量
const TOKEN_SECRET = process.env.TOKEN_SECRET

/**
 * 玩家登陆游戏接口（注意这是登陆，而不是进入游戏玩游戏）
 */
module.exports.playerLogin = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,查询玩家，获取商户/代理信息
        const playerModel = new PlayerModel()
        let userName = inparam.userName
        let userId = inparam.userId
        let playerInfo = {}
        //代理玩家
        if (userId == '0' || inparam.buId == '0') {
            //查询玩家的信息,获取代理的id
            playerInfo = await playerModel.getPlayerByUserName(userName)
            if (_.isEmpty(playerInfo)) {
                return ResFail(cb, { msg: '玩家不存在' }, 10012)
            }
            userId = playerInfo.parent
        }
        let userInfo = {}
        //网页商户玩家
        if (inparam.buId) {
            userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        }
        //APP商户玩家或代理玩家
        else {
            userInfo = await new UserModel().queryUserById(userId)
        }
        if (_.isEmpty(userInfo)) {
            return ResFail(cb, { msg: '商户不存在' }, 10001)
        }
        if (userInfo.status == 0) {
            return ResFail(cb, { msg: '商户已停用' }, 10006)
        }
        if (_.isEmpty(playerInfo)) {//说明是商户，商户需要组装用户名
            userName = `${userInfo.suffix}_${userName}`
            playerInfo = await playerModel.getPlayerByUserName(userName)
            if (_.isEmpty(playerInfo)) {
                return ResFail(cb, { msg: '玩家不存在' }, 10012)
            }
        }
        //3,检验密码是否正确，检验商户和玩家是否禁用
        if (playerInfo.password != inparam.userPwd) {
            return ResFail(cb, { msg: '玩家密码不正确' }, 10004)
        }
        if (playerInfo.state == 0) {
            return ResFail(cb, { msg: '玩家已停用' }, 10005)
        }
        //4,从缓存获取玩家余额,更新玩家信息
        playerInfo.usage = 'playerLogin'
        let balance = await playerModel.getNewBalance(playerInfo)
        let gameState = playerInfo.gameState == GameStateEnum.GameIng ? GameStateEnum.GameIng : GameStateEnum.OnLine
        if (playerInfo.gameId >= 1000000) {
            gameState = GameStateEnum.OffLine
        }
        await playerModel.updateJoinGame(userName, { updatedAt: Date.now(), gameState })
        //5,组装返回必要参数
        let loginToken = jwt.sign({ userName, suffix: userInfo.suffix, userId: +playerInfo.userId, exp: Math.floor(Date.now() / 1000) + 86400 }, TOKEN_SECRET)
        let callObj = {
            token: loginToken,
            balance: balance,
            // msn: playerInfo.msn,
            username: userName,
            userId: playerInfo.userId,
            nickname: playerInfo.nickname,
            headPic: playerInfo.headPic,
            // sex: playerInfo.sex || 0,
            // parentId: userId,
            gameList: playerInfo.gameList,
            // liveMix: 0, //无用了
            // vedioMix: 0,//无用了
            gameId: playerInfo.gameId || 0,
            sid: playerInfo.sid || 0,
            isTest: userInfo.isTest
        }
        return ResOK(cb, { msg: 'success', data: callObj }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

// export {
//     playerLogin,                      //玩家登录游戏
// }