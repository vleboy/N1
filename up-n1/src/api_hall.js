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



function sha1(data) {
    let generator = crypto.createHash('sha1')
    generator.update(data)
    return generator.digest('hex')
}

module.exports = router