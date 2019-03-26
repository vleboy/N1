// 系统配置参数
const config = require('config')
const { PORT = config.server.port } = process.env
// 应用服务与中间件相关
const Koa = require('koa')
// const cors = require('@koa/cors')
// const mount = require('koa-mount')
const koaBody = require('koa-body')
const xerror = require('koa-xerror')
const xauth = require('koa-xauth')
const xlog = require('koa-xlog')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 业务控制器
const fixapirouter = require('./src/api_fix')
const checkapirouter = require('./src/api_check')
const repairapirouter = require('./src/api_repair')
const clearapirouter = require('./src/api_clear')
const eventapirouter = require('./src/api_event')
const transferrouter = require('./src/api_transfer')

// 初始化应用服务，加载所有中间件
const app = new Koa()
app.proxy = true
app.use(xerror(config.error))   // 全局错误捕获中间件，必须第一位使用，参数1：错误配置
// 跨域处理
// app.use(mount('/', cors()))     // 修复接口跨域请求
// 入参解析
app.use(koaBody())              // 入参JSON解析中间件
// 认证日志
app.use(xlog(config.log, null))     //日志中间件，参数1：日志配置，参数2：额外日志处理
app.use(xauth(config.auth, (v) => { // TOKEN身份认证中间件，参数1：认证配置，参数2：额外自定义TOKEN解析规则，参数3：自定义错误处理
    let words = v.split(" ")
    return words.length > 1 ? words[1] : words[0]
}, (ctx) => {
    if (ctx.body.name == 'TokenExpiredError') {
        ctx.body.err = 10
        ctx.body.errdesc = 'TOKEN已过期'
    } else if (ctx.body.err) {
        if (ctx.body.res && ctx.body.res.indexOf("未配置访问权限")) {
            ctx.body.err = 19
            ctx.body.errdesc = "没有权限"
        } else {
            ctx.body.err = 10
            ctx.body.errdesc = "TOKEN错误"
        }
    }
}))

// 业务路由
app.use(fixapirouter.routes())          // 修正接口路由
app.use(checkapirouter.routes())        // 检查接口路由
app.use(repairapirouter.routes())       // 修复接口路由
app.use(clearapirouter.routes())        // 清理接口路由
app.use(eventapirouter.routes())        // 触发事件接口路由
app.use(transferrouter.routes())        // 模拟下注

// 启动应用服务
app.listen(PORT)
log.info(`API-STAT服务启动【执行环境:${process.env.NODE_ENV},端口:${PORT}，服务域名:【${config.na.apidomain}】】`)
