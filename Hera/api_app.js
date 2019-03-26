//工具
import { JSONParser } from './libs/JSONParser'
import { ResOK, ResFail } from './libs/Response'
import { BillCheck } from './libs/BillCheck'
import jwt from 'jsonwebtoken'
const _ = require('lodash')
const axios = require('axios')
const CryptoJS = require("crypto-js")
//model
const PlayerModel = require('./models/PlayerModel')
const UserModel = require('./models/UserModel')
//常量
const TOKEN_SECRET = process.env.TOKEN_SECRET
// const GAME_CENTER = process.env.GAME_CENTER
const NALIVE_CENTER = process.env.NALIVE_CENTER
const COMPANY_NA_KEY = process.env.COMPANY_NA_KEY

/**
 * 玩家进入游戏接口
 * gameState 数字，1离线，2大厅，3游戏中
 * gameId 字符串，0是大厅，其他为游戏大类，小于1000000是APP游戏，APP游戏中不能进入网页游戏
 * sid 字符串，具体游戏ID
 */
async function joinGame(e, c, cb) {
    try {
        //1,获取入参
        console.log(e.body)
        const inparam = JSONParser(e.body)
        //2,参数校验
        new BillCheck().checkJoinGame(inparam)
        //3,获取玩家信息
        const playerInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
        const playerModel = new PlayerModel()
        let player = {}
        if (inparam.userId) {
            player = await playerModel.getPlayerById(inparam.userId)
            if (!playerInfo || +playerInfo.userId != inparam.userId) {
                return ResFail(cb, { msg: 'token验证失败' }, 11000)
            }
        } else {
            player = await playerModel.getPlayer(inparam.userName)
            if (!playerInfo || playerInfo.userName != inparam.userName) {
                return ResFail(cb, { msg: 'token验证失败' }, 11000)
            }
        }
        if (player.state != 1) {
            return ResFail(cb, { msg: '玩家已停用' }, 10006)
        }
        //4,如果玩家在app里面玩游戏，则不能进入网页游戏
        if (player.gameState == 3 && player.gameId < 1000000 && inparam.gameId > 1000000) {
            return ResFail(cb, { msg: '玩家正在APP游戏中，不能进入网页游戏' }, 1000)
        }
        //5,校验玩家所属商户是否购买此款游戏
        let userInfo = await new UserModel().queryUserById(player.parent)
        if (userInfo.status != 1) {
            return ResFail(cb, { msg: '商户已停用' }, 10006)
        }
        let index = _.findIndex(userInfo.gameList, function (o) { return o.code == inparam.gameId })
        if (index == -1) {
            return ResFail(cb, { msg: '商家暂无此款游戏' }, 11006)
        } else {
            let company = userInfo.gameList[index].company
            if (_.find(userInfo.companyList, function (o) { return o.company == company }).status == 0) {
                return ResFail(cb, { msg: '商家游戏已被禁用，请联系运营商' }, 11007)
            }
        }
        //6,从缓存表获取玩家最新余额
        player.usage = 'joinGame'
        let balance = await playerModel.getNewBalance(player)
        //7,NA真人需要推送返回
        if (inparam.gameId == 30000) {
            let data = {
                authCode: inparam.authCode,
                userId: player.userId,
                headPic: player.headPic,
                nickName: player.nickname,
                userName: player.userName,
                balance: balance,
                chips: userInfo.chip ? userInfo.chip.join() : '',
                timestamp: Date.now()
            }
            let sdic = Object.keys(data).sort()
            let signBefore = ''
            for (let ki in sdic) {
                signBefore += (sdic[ki] + data[sdic[ki]])
            }
            signBefore = encodeURIComponent(`${signBefore}${COMPANY_NA_KEY}`)
            // 请求NA真人获取游戏地址
            data.sign = CryptoJS.SHA1(signBefore).toString(CryptoJS.enc.Hex)
            console.error(`http://${NALIVE_CENTER}/gate/player/loginWithPlayer`)
            console.log(`原始签名：${signBefore}`)
            console.log(JSON.stringify(data))
            try {
                let naliveres = await axios.post(`http://${NALIVE_CENTER}/gate/player/loginWithPlayer`, data)
                console.log(naliveres.data)
            } catch (error) {
                console.error('NA真人拒绝登录')
                return ResFail(cb, { msg: 'NA真人拒绝登录' }, 500)
            }
        }
        //8,更新玩家，组装更新参数
        let updateParms = {}
        updateParms.gameState = 3
        updateParms.gameId = inparam.gameId
        updateParms.sid = inparam.sid
        updateParms.joinTime = Date.now()                        //更新玩家进入游戏时间
        await playerModel.updateJoinGame(player.userName, updateParms)
        return ResOK(cb, { msg: '操作成功', data: { balance: balance, gameId: updateParms.gameId, sid: updateParms.sid } }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

export {
    joinGame                         //玩家进入游戏
}