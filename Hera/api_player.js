//工具
const JSONParser = require('./libs/JSONParser')
const { ResOK, ResFail } = require('./libs/Response')
const BillCheck = require('./libs/BillCheck')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const crypto = require('crypto')
//model
const PlayerModel = require('./models/PlayerModel')
const UserModel = require('./models/UserModel')
const IPCheck = require('./libs/IPCheck')
//常量
const TOKEN_SECRET = process.env.TOKEN_SECRET
// const uuid = require('uuid/v4')
// const MerchantBillModel = require('./models/MerchantBillModel')

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
        //ip校验
        new IPCheck().validateIP(e, userInfo)
        //4,检验玩家是否存在
        let userName = `${userInfo.suffix}_${inparam.userName}`
        let playerInfo = await new PlayerModel().getPlayerByUserName(userName)
        if (!_.isEmpty(playerInfo)) {
            return ResFail(cb, { msg: '玩家已存在' }, 10003)
        }
        //5,组装参数
        //加密密码
        const sha = crypto.createHash('sha256')
        sha.update(inparam.userPwd)
        let userPwd = sha.digest('hex')
        //生成玩家的userId
        let userId = 0
        let isTrue = true
        while (isTrue) {
            userId = getLengthNum(6)
            let isExist = await new PlayerModel().isUserIdExit(+userId)
            if (!isExist) {
                isTrue = false
            }
        }
        let putParms = {
            userName: userName,
            userId: userId,
            userPwd: userPwd,
            password: inparam.userPwd,
            buId: inparam.buId,
            role: 10000,
            state: 1,
            updateAt: Date.now(),
            createAt: Date.now(),
            balance: 0,
            msn: _.padStart(userInfo.msn, 3, '0'),
            merchantName: userInfo.displayName,
            parent: userInfo.userId,
            parentName: userInfo.username,
            amount: 0,
            sex: 0,
            nickname: 'NULL!',
            headPic: 'NULL!',
            gameState: 1,
            parentSn: userInfo.sn
        }
        await new PlayerModel().putItem(putParms)
        return ResOK(cb, { msg: 'success' }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * 玩家获取token(登录)
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
            return ResFail(cb, { msg: '权限不足' }, 900)
        }
        if (userInfo.status == '0') {
            return ResFail(cb, { msg: '商户已被锁定' }, 10006)
        }
        //4,获取玩家信息
        let userName = `${userInfo.suffix}_${inparam.userName}`
        let playerInfo = await new PlayerModel().getPlayer(userName)
        if (playerInfo.state == 0) {
            return ResFail(cb, { msg: '玩家已经冻结' }, 10006)
        }
        if (playerInfo.password != inparam.userPwd) {
            return ResFail(cb, { msg: '玩家密码不正确' }, 10005)
        }
        //5,生成token返回
        let loginToken = jwt.sign({ userName, suffix: userInfo.suffix, userId: +playerInfo.userId, exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 }, TOKEN_SECRET)
        let data = {
            token: loginToken,
            msn: _.padStart(userInfo.msn, 3, '0'),
            userName: playerInfo.userName,
            userId: playerInfo.userId
        }
        return ResOK(cb, { msg: 'success', data: data }, 0)
    } catch (err) {
        console.error(err)
        return ResFail(cb, { msg: err }, 500)
    }
}

/**
 * 玩家获取自己的余额
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
            return ResFail(cb, { msg: 'token验证失败或过期' }, 11000)
        }
        if (!tokenInfo || !Object.is(`${tokenInfo.suffix}_${userName}`, tokenInfo.userName)) {
            return ResFail(cb, { msg: 'token验证失败或过期' }, 11000)
        }
        userName = `${tokenInfo.suffix}_${userName}`
        const inparam = JSONParser(e.queryStringParameters || {})
        //3,参数校验
        new BillCheck().checkPlayerBalance(inparam)
        //4,获取商户信息
        let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
        if (_.isEmpty(userInfo)) {
            return ResFail(cb, { msg: '所属商户不存在' }, 10001)
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
        return ResFail(cb, { msg: err }, 500)
    }
}

function getLengthNum(len) {
    let number = Number.parseInt(Math.random() * Math.pow(10, len));
    if (number > Math.pow(10, len - 1) && number < Math.pow(10, len)) {
        return number;
    } else {
        return getLengthNum(len);
    }
}

// /**
//  * 玩家修改密码
//  */
// async function updatePassword(e, c, cb) {
//     try {
//         //1,获取入参
//         let userName = decodeURI(e.pathParameters.userName)
//         //2,token校验
//         let tokenInfo = {}
//         try {
//             tokenInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
//         } catch (err) {
//             return ResFail(cb, { msg: 'token验证失败或过期' }, 11000)
//         }
//         if (!tokenInfo || !Object.is(`${tokenInfo.suffix}_${userName}`, tokenInfo.userName)) {
//             return ResFail(cb, { msg: 'token验证失败或过期' }, 11000)
//         }
//         userName = `${tokenInfo.suffix}_${userName}`
//         const inparam = JSONParser(e.body)
//         //3,参数校验
//         new BillCheck().checkPlayerPassword(inparam)
//         //4,获取商户信息
//         let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
//         if (_.isEmpty(userInfo)) {
//             return ResFail(cb, { msg: '商户不存在' }, 10001)
//         }
//         //ip校验
//         new IPCheck().validateIP(e, userInfo)
//         //5,获取玩家信息
//         let playerInfo = await new PlayerModel().getPlayer(userName)
//         if (playerInfo.parent != userInfo.userId) {
//             return ResFail(cb, { msg: '请输入正确的商户buId' }, 10002)
//         }
//         new PlayerModel().updatePwd({ newPwd: inparam.userPwd, userName })
//         return ResOK(cb, { msg: 'success' }, 0)
//     } catch (err) {
//         console.error(err)
//         return ResFail(cb, { msg: err }, 500)
//     }
// }

// /**
//  * 玩家自行充值/提现
//  */
// async function gamePlayerBalance(e, c, cb) {
//     try {
//         //1,获取入参
//         console.log(e)
//         let userName = decodeURI(e.pathParameters.userName)
//         //2,token校验
//         let tokenInfo = {}
//         try {
//             tokenInfo = await jwt.verify(e.headers.Authorization, TOKEN_SECRET)
//         } catch (err) {
//             return ResFail(cb, { msg: 'token验证失败或过期' }, 11000)
//         }
//         if (!tokenInfo || !Object.is(`${tokenInfo.suffix}_${userName}`, tokenInfo.userName)) {
//             return ResFail(cb, { msg: 'token验证失败' }, 11000)
//         }
//         userName = `${tokenInfo.suffix}_${userName}`
//         //3,参数校验
//         const inparam = JSONParser(e.body)
//         let action = inparam.action
//         new BillCheck().checkBalanceHandler(inparam)
//         //4,获取商户信息，并验证相关信息
//         let userInfo = await new UserModel().queryByDisplayId(inparam.buId)
//         if (_.isEmpty(userInfo)) {
//             return ResFail(cb, { msg: '所属商户不存在' }, 10001)
//         }
//         //ip校验
//         new IPCheck().validateIP(e, userInfo)
//         if (userInfo.status == '0') {
//             return ResFail(cb, { msg: '商户已被锁定' }, 10006)
//         }
//         //5,获取玩家信息，并验证
//         const playerModel = new PlayerModel()
//         let playerInfo = await playerModel.getPlayer(userName)
//         if (playerInfo.state == '0') {
//             return ResFail(cb, { msg: '玩家已被冻结' }, 10006)
//         }
//         if (playerInfo.gameState == 3) { //游戏中
//             if (+playerInfo.gameId >= 1000000) {
//                 //更新玩家状态（这个可以充值提现）
//                 await playerModel.updateOffline(userName)
//             } else {
//                 return ResFail(cb, { msg: '玩家在游戏中不能进行充值和提现操作' }, 11001)
//             }
//         }
//         //6,根据不同的操作类型（充值或提现）有不同的处理
//         let usage = inparam.action == -1 ? 'billout' : 'billin' // 提现需要检查余额绝对正确
//         let palyerBalance = await playerModel.getNewBalance({ userName: playerInfo.userName, userId: playerInfo.userId, balance: playerInfo.balance, usage })
//         if (palyerBalance == 'err') {
//             return ResFail(cb, { msg: '账务正在结算中，请联系管理员' }, 500)
//         }
//         if (inparam.action == 1) { //充值操作
//             //获取商户的点数并检查商户的点数是否足够
//             let userBalance = await new MerchantBillModel().queryUserBalance(userInfo.userId)
//             if (userBalance < +inparam.amount) {
//                 return ResFail(cb, { msg: '商户余额不足' }, 500)
//             }
//         } else if (inparam.action == -1) { //提现操作
//             //检查玩家的点数是否足够
//             if (palyerBalance < +inparam.amount) {
//                 return ResFail(cb, { msg: '提现金额大于账户余额' }, 500)
//             }
//         }
//         //7,更新玩家余额，并推送大厅
//         let updateBalance = {
//             userName: playerInfo.userName,
//             userId: playerInfo.userId,
//             amt: action == 1 ? Math.abs(+inparam.amount) : Math.abs(+inparam.amount) * -1
//         }
//         let currentBalanceObj = await playerModel.updatePlayerBalance(updateBalance)
//         //8,写入用户流水表
//         let userBill = {
//             sn: uuid(),
//             fromRole: action == 1 ? '100' : '10000',  //100商户 10000代表玩家
//             toRole: action == 1 ? '10000' : '100',
//             fromUser: action == 1 ? userInfo.username : userName,
//             toUser: action == 1 ? userName : userInfo.username,
//             amount: action == 1 ? Math.abs(+inparam.amount) * -1 : Math.abs(+inparam.amount),
//             operator: userName,
//             remark: action > 0 ? "中心钱包转入" : "中心钱包转出",
//             // gameType: -1,
//             typeName: "中心钱包",
//             username: userInfo.username,
//             userId: userInfo.userId,
//             fromLevel: userInfo.level,
//             fromDisplayName: playerInfo.userName,
//             toDisplayName: playerInfo.userName,
//             toLevel: 10000,
//             action: -action,
//         }
//         //9,写入玩家流水表
//         let playerBill = {
//             sn: uuid(),
//             action: action,
//             type: 11,  //中心钱包
//             gameType: 1,
//             userId: playerInfo.userId,
//             userName: playerInfo.userName,
//             parent: playerInfo.parent,
//             originalAmount: currentBalanceObj.originalAmount,
//             amount: currentBalanceObj.amount,
//             balance: currentBalanceObj.balance
//         }
//         await new MerchantBillModel().playerBillTransfer(userBill, playerBill)
//         return ResOK(cb, { msg: 'success', data: { balance: currentBalanceObj.balance } }, 0)
//     } catch (err) {
//         console.error(err)
//         return ResFail(cb, { msg: err }, 500)
//     }
// }

// export {
//     gamePlayerRegister,               //玩家注册
//     playerLoginToken,                 //玩家获取登录的token
//     getGamePlayerBalance              //玩家获取自己的余额
//     // updatePassword,                   //玩家更新密码
//     // gamePlayerBalance,                //玩家自行充值/提现
// }