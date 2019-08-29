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
 * API玩家登陆获取TOKEN
 * buId
 * userName
 * userPwd
 */
module.exports.playerLogin = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,查询玩家，获取父级信息
        const playerModel = new PlayerModel()
        let userName = inparam.userName
        let playerInfo = {}
        let userInfo = {}
        // API接线玩家
        if (inparam.buId) {
            userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        }
        // 全帐号登录玩家
        else {
            playerInfo = await playerModel.getPlayerByUserName(userName)
            if (_.isEmpty(playerInfo)) {
                return ResFail(cb, { msg: '玩家不存在' }, 10012)
            }
            userInfo = await new UserModel().queryUserById(playerInfo.parent)
        }
        if (_.isEmpty(userInfo)) {
            return ResFail(cb, { msg: '商户不存在' }, 10001)
        }
        if (userInfo.status == 0) {
            return ResFail(cb, { msg: '商户已停用' }, 10006)
        }
        // API接线玩家需要组装完整帐号
        if (_.isEmpty(playerInfo)) {
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
        //校验玩家进入那个地区
        let region = 'main'                                              //默认进入地区
        let managerId = 'ab1f70d9-31ea-4aed-a5a5-b013cbff370c'           //设置一个线路商id 标识 以下所有商户玩家只能进入进入柬埔寨
        let users = await new UserModel().queryAllChild(managerId)
        if (_.findIndex(users.Items, o => o.userId == playerInfo.parent) != -1) {
            region = 'vn'
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
            username: userName,
            userId: playerInfo.userId,
            nickname: playerInfo.nickname,
            // headPic: playerInfo.headPic,
            gameList: playerInfo.gameList,
            gameId: playerInfo.gameId || 0,
            sid: playerInfo.sid || 0,
            isTest: userInfo.isTest,
            region
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