//工具
const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const BillCheck = require('./libs/BillCheck')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
//model
const PlayerModel = require('./models/PlayerModel')
const UserModel = require('./models/UserModel')
const LogModel = require('./models/LogModel')
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
        //2,参数校验
        // new BillCheck().checkPlayerLogin(inparam)
        //3,查询玩家，获取商户/代理信息
        const playerModel = new PlayerModel()
        let userName = inparam.userName
        let userId = inparam.userId
        let playerInfo = {}
        //代理玩家
        if (userId == '0' || inparam.buId == '0') {
            //查询玩家的信息,获取代理的id
            playerInfo = await playerModel.getPlayerByUserName(userName)
            if (_.isEmpty(playerInfo)) {
                return ResFail(cb, { msg: '玩家不存在' }, 10004)
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
            return ResFail(cb, { msg: '所属商户或代理不存在' }, 10001)
        }
        if (_.isEmpty(playerInfo)) {//说明是商户，商户需要组装用户名
            userName = `${userInfo.suffix}_${userName}`
            playerInfo = await playerModel.getPlayerByUserName(userName)
            if (_.isEmpty(playerInfo)) {
                return ResFail(cb, { msg: '玩家不存在' }, 10004)
            }
        }
        //4,检验密码是否正确，检验商户和玩家是否禁用
        if (playerInfo.password != inparam.userPwd) {
            return ResFail(cb, { msg: '密码不正确' }, 10005)
        }
        if (userInfo.status == 0 || playerInfo.state == 0) {
            return ResFail(cb, { msg: '商户或玩家已被禁用' }, 10006)
        }
        //5,从缓存获取玩家余额,更新玩家信息
        playerInfo.usage = 'playerLogin'
        let balance = await playerModel.getNewBalance(playerInfo)
        let gameState = playerInfo.gameState == 3 ? 3 : 2
        if (playerInfo.gameId >= 1000000) {
            gameState = 1
        }
        await playerModel.updateJoinGame(userName, { updateAt: Date.now(), gameState })
        //6,组装返回必要参数
        let loginToken = jwt.sign({ userName, suffix: userInfo.suffix, userId: +playerInfo.userId, exp: Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60 }, TOKEN_SECRET)
        let callObj = {
            token: loginToken,
            balance: balance,
            msn: playerInfo.msn,
            createAt: playerInfo.createAt,
            updateAt: playerInfo.updateAt,
            username: userName,
            userId: playerInfo.userId,
            nickname: playerInfo.nickname,
            headPic: playerInfo.headPic,
            sex: playerInfo.sex || 0,
            parentId: userId,
            gameList: playerInfo.gameList,
            liveMix: 0, //无用了
            vedioMix: 0,//无用了
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

/**
 * 玩家退出游戏接口
 */
module.exports.playerExit = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkPlayerExit(inparam)
        //3,业务逻辑
        const playerModel = new PlayerModel()
        if (inparam.uids.length == 1 && inparam.uids[0] == '1') {  //平台所有玩家全部离线处理
            let playerInfos = await playerModel.scan({
                ProjectionExpression: 'userName',
                FilterExpression: 'gameState <> :gameState OR gameId <> :gameId',
                ExpressionAttributeValues: {
                    ':gameState': 1,
                    ':gameId': '0'
                }
            })
            if (playerInfos && playerInfos.Items.length != 0) {
                for (let player of playerInfos.Items) {
                    playerModel.updateOffline(player.userName)
                }
            }
            return ResOK(cb, { msg: '操作成功', data: { list: [] } }, 0)
        } else {  //退出指定的玩家
            let returnArr = []
            for (let uid of inparam.uids) {
                let playerInfo = await playerModel.getPlayerById(uid)
                // if (playerInfo.gameId == '10000') { //玩家在棋牌游戏
                //     if (inparam.state == 2) { //正常退出 回到大厅
                //         await playerModel.updateOffline(playerInfo.userName, { gameState: 2 })
                //     } else { //异常退出，会启动断线重连
                //         await playerModel.updateOffline(playerInfo.userName, { gameId: '10000' })
                //     }
                // } else {
                await playerModel.updateOffline(playerInfo.userName)
                // }
                new LogModel().add('6', 'playerExit', playerInfo, `玩家${playerInfo.userName}大厅离线`)
                //这里返回的更新前的信息（曹文要求的）
                returnArr.push({
                    userId: playerInfo.userId,
                    gameId: playerInfo.gameId,
                    sid: playerInfo.sid,
                    gameState: playerInfo.gameState
                })
            }
            return ResOK(cb, { msg: '操作成功', data: { list: returnArr } }, 0)
        }
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * 大厅修改玩家信息
 */
module.exports.updatePlayerInfo = async function (e, c, cb) {
    try {
        //1,获取入参
        const inparam = JSONParser(e.body)
        console.log(inparam)
        //2,参数校验
        new BillCheck().checkUpdateInfo(inparam)
        const tokenInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
        if (!tokenInfo || inparam.userId != tokenInfo.userId) {
            return ResFail(cb, { msg: '玩家校验失败' }, 11000)
        }
        //3,获取玩家信息
        let playerInfo = await new PlayerModel().getPlayerByUserName(tokenInfo.userName)
        if (_.isEmpty(playerInfo)) {
            return ResFail(cb, { msg: '玩家不存在' }, 10004)
        }
        //4,检查nickname是否重复
        if (inparam.nickname) {
            let isExist = await new PlayerModel().scan({
                ProjectionExpression: 'userName',
                FilterExpression: 'nickname=:nickname AND userName<>:userName',
                ExpressionAttributeValues: {
                    ':nickname': inparam.nickname,
                    ':userName': playerInfo.userName
                }
            })
            if (isExist.Items.length != 0) {
                return ResFail(cb, { msg: '该昵称已被占用' }, 14003)
            }
        }
        //5,组装更新参数
        let updateObj = {}
        for (let key in inparam) {
            if (Object.is(key, "nickname") || Object.is(key, "headPic") || Object.is(key, "sex")) {
                if (inparam[key]) {
                    updateObj[key] = inparam[key];
                }
            }
        }
        //6,更新
        await new PlayerModel().hallUpdateInfo(playerInfo.userName, updateObj)
        return ResOK(cb, { msg: '操作成功' }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

// export {
//     playerLogin,                      //玩家登录游戏
//     playerExit,                       //玩家退出游戏
//     updatePlayerInfo                  //大厅更新玩家信息
// }