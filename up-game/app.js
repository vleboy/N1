const config = require('config')
const { PORT = 3000 } = process.env
// 应用服务与中间件相关
const Koa = require('koa')
const cors = require('@koa/cors')
const koaBody = require('koa-body')
const xerror = require('koa-xerror')
const xauth = require('koa-xauth')
const xlog = require('koa-xlog')
// const mount = require('koa-mount')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

// 业务控制器
const pingRoute = require('./src/api_ping')
const companyRoute = require('./src/api_company')
const gameRoute = require('./src/api_game')
const toolRoute = require('./src/api_tool')
const packageRoute = require('./src/api_package')
const seatRoute = require('./src/api_seat')

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
PORT == 3000 && app.use(cors())                // 允许跨域请求
app.use(koaBody())                             // 入参JSON解析中间件
app.use(xlog(config.log, (ctx) => {            // 日志中间件，参数1：日志配置，参数2：额外日志处理
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

app.use(pingRoute.routes())             // 心跳接口
app.use(companyRoute.routes())          // 游戏厂商接口
app.use(gameRoute.routes())             // 游戏接口
app.use(toolRoute.routes())             // 道具接口
app.use(packageRoute.routes())          // 道具包接口
app.use(seatRoute.routes())             // 展位接口

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
