// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const Cache = require('./lib/Cache')
const _ = require('lodash')
const axios = require('axios')
var crypto = require('crypto')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const HallCheck = require('./biz/HallCheck')
const UserModel = require('./model/UserModel')
const NoticeModel = require('./model/NoticeModel')
const EmailModel = require('./model/EmailModel')
const AdModel = require('./model/AdModel')
const PlayerModel = require('./model/PlayerModel')

// const jwt = require('jsonwebtoken')
const SeatModel = require('./model/SeatModel')
const ToolModel = require('./model/ToolModel')
const PackageModel = require('./model/PackageModel')
// const ConfigModel = require('./model/ConfigModel')
// const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
// const HeraGameRecordModel = require('./model/HeraGameRecordModel')

// 跑马灯信息
router.post('/notice/info', async function (ctx, next) {
    let inparam = ctx.request.body
    //2,参数校验
    new HallCheck().checkNoticeInfo(inparam)
    //3,业务操作
    let notice = await new NoticeModel().getNotice(inparam.noid)
    if (_.isEmpty(notice)) {
        throw { code: 13100, msg: "跑马灯不存在" }
    }
    // 返回结果
    ctx.body = { code: 0, data: notice, msg: "success" }
})

// 邮件信息
router.post('/email/info', async function (ctx, next) {
    let inparam = ctx.request.body
    //2,参数校验
    new HallCheck().checkEmailInfo(inparam)
    //3,业务处理
    let email = await new EmailModel().getEmail(inparam.emid)
    if (_.isEmpty(email)) {
        throw { code: 13100, msg: "邮件不存在" }
    }
    // 返回结果
    ctx.body = { code: 0, data: email, msg: "success" }
})

// 获取公告信息
router.get('/game/advert/list/:operatorName', async function (ctx, next) {
    let inparam = ctx.params
    const adList = await new AdModel().HallList(inparam)
    // 返回结果
    ctx.body = { code: 0, data: { list: adList }, msg: "success" }
})

// 商户信息
router.post('/merchant/info', async function (ctx, next) {
    //1,获取入参
    const inparam = ctx.request.body
    //2,参数校验
    new HallCheck().checkUserInfo(inparam)
    //3,获取商户信息
    let userInfo = await new UserModel().queryUserById(inparam.parentId)
    //4,组装返回数据
    let returnObj = {
        username: userInfo.username,
        id: userInfo.userId,
        role: userInfo.role,
        headPic: "NULL!",
        parentId: userInfo.parent,
        msn: userInfo.msn || "0",
        gameList: (userInfo.gameList && userInfo.gameList.length != 0 && userInfo.gameList != "NULL!") ? userInfo.gameList.map((game) => game.code) : [],
        liveMix: 0,
        vedioMix: 0,
        rate: userInfo.rate || 100,
        nickname: userInfo.displayName || "NULL!",
        suffix: userInfo.suffix,
        levelIndex: userInfo.levelIndex + "",
        merUrl: userInfo.frontURL || "-1",
        sn: userInfo.sn || 'NULL!',
        moneyURL: (userInfo.moneyURL && userInfo.moneyURL != "NULL!") ? userInfo.moneyURL : '',
        registerURL: (userInfo.registerURL && userInfo.registerURL != "NULL!") ? userInfo.registerURL : '',
        feedbackURL: (userInfo.feedbackURL && userInfo.feedbackURL != "NULL!") ? userInfo.feedbackURL : '',
        launchImg: (userInfo.launchImg && userInfo.launchImg != "NULL!") ? userInfo.launchImg : { logo: ["", ""], name: ["", ""] },
        skin: userInfo.skin || "1",
        isOpenBrowser: userInfo.isOpenBrowser ? true : false,
        isTest: userInfo.isTest || 0,
        passhash: userInfo.role == 1 ? sha1(userInfo.password) : 'NULL!'
    }
    //管理员没有gameList
    if (userInfo.level == 0) {
        returnObj.gameList = ["30000", "40000", "60000", "70000", "90000"]
    }
    returnObj.code = 0
    returnObj.msg = "success"
    // 返回结果
    ctx.body = returnObj
})

// 验证玩家是否含有70000/80000/90000的游戏
router.get('/player/gameList/:userId', async function (ctx, next) {
    //1,获取入参
    const inparam = ctx.params
    //2,参数校验
    new HallCheck().checkPlayerId(inparam)
    //3,查询玩家
    let playerInfo = await new PlayerModel().getPlayerById(inparam.userId)
    //4,获取商户下的游戏列表
    let userInfo = await new UserModel().queryUserById(playerInfo.parent, { ProjectionExpression: "gameList" })
    //5,查找游戏是否含有70000/80000/90000
    let gameArr = []
    for (let game of userInfo.gameList) {
        if (game.code == '70000' || game.code == '80000' || game.code == '90000') {
            gameArr.push(game.code)
        }
    }
    // 返回结果
    ctx.body = gameArr
})

// 系统配置
// router.post('/sysconfig', async function (ctx, next) {
//     let inparam = ctx.request.body
//     const ret = await new ConfigModel().getOne(inparam)
//     // 返回结果
//     ctx.body = { code: 0, payload: ret, msg: "success" }
// })

// 获取排行榜
router.post('/statistics/userRank', async function (ctx, next) {
    let inparam = ctx.request.body
    // 检查参数是否合法
    new HallCheck().checkRank(inparam)
    // REDIS缓存查询
    const env = config.env.ANOTHER_GAME_CENTER == 'webgame.na12345.com' ? 'PROD' : 'DEV'
    const cache = new Cache()
    const cacheRes = await cache.get(`NA_${env}_PLAYER_RANK`)
    cache.quit()
    // 缓存存在，进行业务查询
    let listOne = [] //前后用户
    let listAll = [] //200名用户
    if (!_.isEmpty(cacheRes)) {
        const descResult = _.orderBy(cacheRes.list, [inparam.sortkey], ['desc'])
        for (let i = 1; i <= descResult.length; i++) {
            descResult[i - 1] = { ...descResult[i - 1], index: i }
        }
        let targetUserIndex = _.findIndex(descResult, function (i) { return i.userName == inparam.userName })
        if (targetUserIndex != -1) {
            let start = targetUserIndex < 2 ? 0 : targetUserIndex - 2
            let end = start + 5 > descResult.length - 1 ? descResult.length : targetUserIndex + 3
            listOne = _.slice(descResult, start, end)
        }
        listAll = descResult.slice(0, 200)
    }
    // 判断更新缓存
    if (_.isEmpty(cacheRes) || cacheRes.expire < Date.now()) {
        await axios.get(`https://${config.env.ANOTHER_GAME_CENTER}/stat/eventPlayerRank`)
    }
    // 返回结果
    ctx.body = { code: 0, listOne, listAll, msg: "success" }
})

// 道具列表
router.get('/game/tool/list', async function (ctx, next) {
    let toolList = await new ToolModel().scan()
    let list = []
    if (!_.isEmpty(toolList.Items)) {
        list = _.orderBy(toolList.Items, ['order'])
    }
    // 返回结果
    ctx.body = { code: 0, list, msg: "success" }
})

// 道具包列表
router.get('/game/package/list', async function (ctx, next) {
    let packageList = await new PackageModel().scan()
    let list = []
    if (!_.isEmpty(packageList.Items)) {
        list = _.orderBy(packageList.Items, ['order'])
    }
    // 返回结果
    ctx.body = { code: 0, list, msg: "success" }
})

// 席位列表
router.post('/game/seat/list', async function (ctx, next) {
    let inparam = ctx.request.body
    let list = await new SeatModel().getList(inparam)
    list = _.orderBy(list, ['order'])
    // 返回结果
    ctx.body = { code: 0, list, msg: "success" }
})

function sha1(data) {
    let generator = crypto.createHash('sha1')
    generator.update(data)
    return generator.digest('hex')
}

module.exports = router