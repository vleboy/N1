const config = require('config')
const { PORT = 3000 } = process.env
// 应用服务与中间件相关
const Koa = require('koa')
const koaBody = require('koa-body')
const xerror = require('koa-xerror')
const xauth = require('koa-xauth')
const xlog = require('koa-xlog')
// const mount = require('koa-mount')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 业务控制器
// const jwt = require('jsonwebtoken')
// const authtestrouter = require('./src/api_authtest')

const billRoute = require('./src/api_bill')
const calcRoute = require('./src/api_calc')
const captchaRoute = require('./src/api_captcha')
const configRoute = require('./src/api_config')
const pingRoute = require('./src/api_ping')
const playerRoute = require('./src/api_player')
const queryRoute = require('./src/api_query')
const subroleRoute = require('./src/api_subrole')
const statRoute = require('./src/api_sys_stat')
const uploadRoute = require('./src/api_upload')
const userRoute = require('./src/api_user')
const mysteryRoute = require('./src/api_mystery')
// const gameRoute = require('./src/api_game')

// 初始化应用服务，加载所有中间件
const app = new Koa()
app.proxy = true
app.use(xerror(config.error, (ctx, err) => {   // 全局错误捕获中间件，必须第一位使用，参数1：错误配置，参数2：自定义错误处理
    if (ctx.status == 400) {
        ctx.status = 200
        ctx.body.code = -1
        ctx.body.msg = '非法入参'
    }
    else if (!ctx.body.code) {
        ctx.body.code = -1
        ctx.body.msg = '内部系统异常'
    }
}))
app.use(koaBody())                              // 入参JSON解析中间件
app.use(xlog(config.log, (ctx) => {             // 日志中间件，参数1：日志配置，参数2：额外日志处理
    // 统一输入数据trim处理
    if (ctx.request.body) {
        for (let i in ctx.request.body) {
            if (typeof (ctx.request.body[i]) == 'string') {
                ctx.request.body[i] = ctx.request.body[i].trim()
                if (ctx.request.body[i] == 'NULL!' || ctx.request.body[i] == '') {
                    ctx.request.body[i] = null
                }
            }
        }
    }
}))
app.use(xauth(config.auth, (v) => {             // TOKEN身份认证中间件，参数1：认证配置，参数2：额外自定义TOKEN解析规则，参数3：自定义错误处理
    let words = v.split(" ")
    return words.length > 1 ? words[1] : words[0]
}, (ctx) => {
    if (ctx.body.name == 'TokenExpiredError') {
        ctx.body.code = -2
        ctx.body.msg = 'TOKEN已过期'
    } else if (ctx.body.err) {
        if (ctx.body.res && ctx.body.res.indexOf("未配置访问权限")) {
            ctx.body.code = 14001
            ctx.body.msg = "没有权限"
        } else {
            ctx.body.code = 11000
            ctx.body.msg = "token错误"
        }
    }
}))
// 临时拦截人为定义过期TOKEN
// app.use((ctx, next) => {
//     let token = ctx.header[config.auth.tokenname] || ctx.header.token
//     if (token && token.toString().length > 10) {
//         const tokenVerify = jwt.verify(token, config.auth.secret)
//         if (!tokenVerify || !tokenVerify.iat || Math.floor(Date.now() / 1000) - parseInt(tokenVerify.iat) > 60 * 60) {
//             ctx.body = {}
//             ctx.body.code = -2
//             ctx.body.msg = 'TOKEN已过期'
//         } else {
//             return next()
//         }
//     } else {
//         return next()
//     }
// })
// app.use(authtestrouter.routes())        // 业务路由中间件
// app.use(mount("/game", playerGameRoute.routes())) // 游戏大厅服务器与玩家相关

app.use(billRoute.routes())                 // 账单日志接口
app.use(calcRoute.routes())                 // 报表统计接口
app.use(captchaRoute.routes())              // 验证码接口
app.use(configRoute.routes())               // 系统配置接口服务
app.use(pingRoute.routes())                 // PING接口
app.use(playerRoute.routes())               // 后台管理系统与玩家相关（新）
app.use(queryRoute.routes())                // 查询平台用户统计接口
app.use(subroleRoute.routes())              // 子角色配置接口
app.use(statRoute.routes())                 // 看板
app.use(uploadRoute.routes())               // 图片上传
app.use(userRoute.routes())                 // 代理接口
app.use(mysteryRoute.routes())              // 神秘大奖
// app.use(gameRoute.routes())                 // NA平台游戏接口

app.use(function (ctx, next) {
    ctx.status = 404
    ctx.body = {
        code: 404,
        msg: "not fount"
    }
})

// 启动应用服务
app.listen(PORT)
log.info(`up-koa服务启动【执行环境:${process.env.NODE_ENV},端口:${PORT},${config.log.level},${config.env.IMG_BUCKET}】`)
