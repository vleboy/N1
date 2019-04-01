// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const axios = require('axios')
const querystring = require('querystring')
const parseString = require('xml2js').parseString
const CryptoJS = require("crypto-js")
// 日志相关
const moment = require('moment')
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const NASign = require('./lib/NASign')

/**
 * 检查UG会员登录接口
 * @param {*} APIPassword 接口检验密码
 * @param {*} SessionID 会员状态
 * @param {*} GameID 游戏编号
 * @param {*} WebType 网站数据
 * @param {*} LoginIP 登录IP
 * @param {*} Language 语言
 * @param {*} PageStyle 页面样式
 */
router.post('/ug/login', async function (ctx, next) {
    // UG认证
    log.info(ctx.request.rawBody)
    let inparam = JSON.parse(ctx.request.rawBody)
    if (ugAuthDeny(inparam.APIPassword)) { return }
    // 解析NA的玩家TOKEN
    const decoded = jwt.decode(inparam.SessionID)
    // 请求N1服务器是否允许玩家进入游戏
    log.info(`请求NA平台【POST】${config.na.joingameurl}`)
    log.info('请求NA平台【参数】' + JSON.stringify({
        userId: decoded.userId,
        gameId: config.ug.gameType,
        sid: config.ug.gameId
    }))
    const nares = await axios.post(config.na.joingameurl, {
        userId: decoded.userId,
        gameId: config.ug.gameType,
        sid: config.ug.gameId,
        token: inparam.SessionID
    })
    // 根据返回结果是否允许玩家进入游戏
    if (nares.data.code != 0) {
        log.error(nares.data)
        ctx.body = { code: nares.data.code, msg: nares.data.msg }
        return
    }
    // 业务处理
    let ErrorCode = 0
    let ErrorMessage = ''
    let Account = ''
    let UserName = ''
    let ShowName = ''
    const player = await new PlayerModel().getPlayer(decoded.userName)
    if (!player || _.isEmpty(player)) {
        log.error(`玩家${decoded.userName}不存在`)
        ErrorCode = 1
        ErrorMessage = `玩家${decoded.userName}不存在`
    } else {
        Account = player.userId
        UserName = player.userName
        ShowName = player.userName
    }
    log.info('返回UG数据')
    log.info({ ErrorCode, ErrorMessage, AgentID: 0, Account, UserName, ShowName, Currency: 'RMB' })
    ctx.body = { ErrorCode, ErrorMessage, AgentID: 0, Account, UserName, ShowName, Currency: 'RMB' }
})

/**
 * 检查UG会员余额
 * @param {*} APIPassword 接口检验密码
 * @param {*} Account 登录帐号
 */
router.post('/ug/balance', async function (ctx, next) {
    // UG认证
    log.info(ctx.request.rawBody)
    let inparam = JSON.parse(ctx.request.rawBody)
    if (ugAuthDeny(inparam.APIPassword)) { return }
    // 业务处理
    let ErrorCode = 0
    let ErrorMessage = ''
    let Balance = 0
    const player = await new PlayerModel().getPlayerById(inparam.Account)
    if (!player || _.isEmpty(player)) {
        log.error(`玩家${inparam.Account}不存在`)
        ErrorCode = 1
        ErrorMessage = `玩家${inparam.Account}不存在`
    } else {
        Balance = +player.balance.toFixed(2)
    }
    log.info('返回UG数据')
    log.info({ ErrorCode, ErrorMessage, Balance })
    ctx.body = { ErrorCode, ErrorMessage, Balance }
})

/**
 * UG游戏交易
 * @param {*} APIPassword 接口检验密码
 * @param {*} Method Transfer
 * @param {*} Account 登录帐号
 * @param {*} Amount 金额
 * @param {*} TransactionNo 交易号
 * @param {*} BetID 注单编号
 */
router.post('/ug/transaction', async function (ctx, next) {
    // UG认证
    log.info(ctx.request.rawBody)
    let inparam = JSON.parse(ctx.request.rawBody)
    if (ugAuthDeny(inparam.APIPassword)) { return }
    // 业务处理
    let ErrorCode = 0
    let ErrorMessage = ''
    let Balance = 0
    let Account = 0.0
    let BetID = ''
    let TransactionNo = ''
    let Amount = 0.0
    let balanceArr = []
    for (let item of inparam.Data) {
        Account = item.Account
        BetID = item.BetID
        TransactionNo = item.TransactionNo
        Amount = item.Amount
        const player = await new PlayerModel().getPlayerById(Account)
        if (!player || _.isEmpty(player)) {
            log.error(`玩家${Account}不存在`)
            ErrorCode = 1
            ErrorMessage = `玩家${Account}不存在`
        } else {
            // 检查第三方交易号是否重复
            let cancelBill = await new PlayerModel().getBill(`AUG_${TransactionNo}`)
            if (cancelBill && !_.isEmpty(cancelBill)) {
                ErrorCode = 1
                ErrorMessage = '交易号重复'
                log.error(`第三方交易号【${TransactionNo}】重复`)
                break
            } else {
                // 计算玩家实时余额和更新
                item.gameType = config.ug.gameType                               // TODO:从配置文件获取游戏类型，未来考虑自动获取
                item.amt = parseFloat(Amount)                                    // 金额转换
                item.businessKey = `BUG_${Account}_${BetID}`                     // 设置局号
                item.txnid = `UG_${Account}_${TransactionNo}`                    // 设置第三方系统唯一流水号
                item.txnidTemp = TransactionNo                                   // 缓存第三方交易号
                console.info(item)
                Balance = await new PlayerModel().updatebalance(player, item)
            }
        }
        balanceArr.push({ ErrorCode: 0, ErrorMessage, Account, TransactionNo, Balance })
    }
    log.info('返回UG数据')
    log.info({ ErrorCode, ErrorMessage, Balance: balanceArr })
    ctx.body = { ErrorCode, ErrorMessage, Balance: balanceArr }
})

/**
 * UG取消交易
 * @param {*} APIPassword 接口检验密码
 * @param {*} Method Cancel
 * @param {*} TransactionNo 交易号
 */
router.post('/ug/cancel', async function (ctx, next) {
    // UG认证
    log.info(ctx.request.rawBody)
    let inparam = JSON.parse(ctx.request.rawBody)
    if (ugAuthDeny(inparam.APIPassword)) { return }
    // 业务处理
    let TransactionNo = inparam.TransactionNo
    let ErrorCode = 0
    let ErrorMessage = ''
    let cancelBill = await new PlayerModel().getBill(`AUG_${TransactionNo}`)
    if (cancelBill) {
        let item = {}
        let player = { userId: cancelBill.userId, userName: cancelBill.userName, parent: cancelBill.parent }
        // 计算玩家实时余额和更新
        item.gameType = config.ug.gameType                               // TODO:从配置文件获取游戏类型，未来考虑自动获取
        item.amt = Math.abs(cancelBill.amount)                           // 金额转换
        item.businessKey = cancelBill.businessKey                        // 设置局号
        item.txnid = cancelBill.txnid                                    // 设置第三方系统唯一流水号
        item.billType = 5                                                // 设置为返还
        Balance = await new PlayerModel().updatebalance(player, item)
    }
    log.info('返回UG数据')
    log.info({ ErrorCode, ErrorMessage })
    ctx.body = { ErrorCode, ErrorMessage }
})

/**
 * UG检查交易结果
 * @param {*} APIPassword 接口检验密码
 * @param {*} Method Check
 * @param {*} TransactionNo 交易号
 */
router.post('/ug/check', async function (ctx, next) {
    // UG认证
    log.info(ctx.request.rawBody)
    let inparam = JSON.parse(ctx.request.rawBody)
    if (ugAuthDeny(inparam.APIPassword)) { return }
    // 业务处理
    let TransactionNo = inparam.TransactionNo
    let ErrorCode = 0
    let ErrorMessage = ''
    let Account = ''
    let Balance = 0
    let cancelBill = await new PlayerModel().getBill(`AUG_${TransactionNo}`)
    if (cancelBill) {
        Balance = +cancelBill.balance.toFixed(2)
    }
    log.info('返回UG数据')
    log.info({ ErrorCode, ErrorMessage, Account, TransactionNo, Balance })
    ctx.body = { ErrorCode, ErrorMessage, Account, TransactionNo, Balance }
})

/**
 * 网页玩家登出
 * @param {*} userId 玩家ID
 */
router.get('/ug/logout/:userId', async function (ctx, next) {
    // 检查玩家是否未完成结算
    const player = await new PlayerModel().getPlayerById(ctx.params.userId)
    if (!player || _.isEmpty(player)) {
        log.error(`玩家${ctx.params.userId}不存在`)
        ctx.body = { code: -1, msg: `玩家${ctx.params.userId}不存在` }
        return
    }
    const data = {
        gameId: config.ug.gameId,
        userId: ctx.params.userId,
        timestamp: Date.now(),
        exit: 1,
        records: [],
        zlib: 1
    }
    NASign.bindSign(config.ug.gameKey, ['gameId', 'timestamp', 'records'], data)
    // 登出NA平台
    log.info(`请求NA平台【POST】${config.na.settlementurl}`)
    log.info('请求NA平台【参数】' + JSON.stringify(data))
    const res = await axios.post(config.na.settlementurl, data)
    if (res.data.code == 0) {
        // ctx.body = { code: 0, msg: '退出成功' }
        ctx.redirect('http://uniwebview.na77.com?key=value&anotherKey=anotherValue')
        log.info(`玩家【${ctx.params.userId}】退出成功`)
    } else {
        log.error(res.data)
        ctx.body = res.data
    }
})

/**
 * 查询UG用户下注详情
 */
router.get('/ug/betpage/:sortNo', async function (ctx, next) {
    const betpageurl = `${config.ug.apiurl}GetBetSheetBySort?APIPassword=${config.ug.apikey}&SortNo=${ctx.params.sortNo}&Rows=1000`
    log.info(`请求UA【POST】${betpageurl}`)
    const res = await axios.get(betpageurl)
    const finalRes = await xmlParse(res.data)
    const finalData = JSON.parse(finalRes.string) || {}
    ctx.body = finalData.Data || []
})

// 私有方法：XML解析
function xmlParse(xml) {
    return new Promise((reslove, reject) => {
        parseString(xml, function (err, res) {
            reslove(res)
        })
    })
}

// UG加密
function ugEnctypt(data, secretkey, secretiv) {
    const key = CryptoJS.enc.Utf8.parse(secretkey)
    const iv = CryptoJS.enc.Utf8.parse(secretiv)
    var encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.ZeroPadding
    })
    return encrypted.toString()
}
// UG解密
function ugDecrypt(encrypted, secretkey, secretiv) {
    const key = CryptoJS.enc.Utf8.parse(secretkey)
    const iv = CryptoJS.enc.Utf8.parse(secretiv)
    var decrypted = CryptoJS.AES.decrypt(encrypted, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.ZeroPadding
    })
    return CryptoJS.enc.Utf8.stringify(decrypted)// 转换为 utf8 字符串
}
// UG认证
function ugAuthDeny(encrypted) {
    let decryptData = ugDecrypt(encrypted, config.ug.apikey, config.ug.apiiv)
    let time = parseInt(decryptData.substring(32))
    if (!time || time.toString().length != 10 || parseInt(Date.now() / 1000) - time > 600) {
        log.error('非法UG请求')
        return true
    }
    return false
}

module.exports = router