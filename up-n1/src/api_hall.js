// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const HallCheck = require('./biz/HallCheck')
const UserModel = require('./model/UserModel')
const PlayerModel = require('./model/PlayerModel')

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

module.exports = router