// 系统配置参数
const config = require('config')
const { PORT = config.server.port } = process.env
// 应用服务与中间件相关
const Koa = require('koa')
const cors = require('@koa/cors')
const mount = require('koa-mount')
const koaBody = require('koa-body')
const xmlParser = require('koa-xml-body')
const bodyParser = require('koa-bodyparser')
const xerror = require('koa-xerror')
const xauth = require('koa-xauth')
const xlog = require('koa-xlog')
// const staticServer = require('koa-static')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 业务控制器
const webapirouter = require('./src/api_web')
const ttgrouter = require('./src/api_ttg')
const sarouter = require('./src/api_sa')
const mgrouter = require('./src/api_mg')
const agrouter = require('./src/api_ag')
const ysbrouter = require('./src/api_ysb')
const rtgrouter = require('./src/api_rtg')
const sbrouter = require('./src/api_sb')
const dtrouter = require('./src/api_dt')
const pprouter = require('./src/api_pp')
const habarouter = require('./src/api_haba')
const pgrouter = require('./src/api_pg')
const pngrouter = require('./src/api_png')
const kyrouter = require('./src/api_ky')
const vgrouter = require('./src/api_vg')

// const socketrouter = require('./src/socket_game')
// const cq9router = require('./src/api_cq9')
// const ugrouter = require('./src/api_ug')
// 初始化应用服务，加载所有中间件
const app = new Koa()
app.proxy = true
// 启用静态资源服务
// app.use(mount(config.server.staticRoot, staticServer(__dirname + '/static')))
app.use(xerror(config.error))           // 全局错误捕获中间件，必须第一位使用，参数1：错误配置
// 跨域处理
app.use(mount('/webapi/', cors()))      // TTG网页跨域请求
app.use(mount('/webapi/', koaBody()))   // TTG网页入参JSON解析中间件
app.use(mount('/sa/', cors()))          // SA网页跨域请求
app.use(mount('/mg/', cors()))          // MG网页跨域请求
app.use(mount('/ag/', cors()))          // AG网页跨域请求
app.use(mount('/ysb/', cors()))         // YSB网页跨域请求
app.use(mount('/rtg/', cors()))         // RTG网页跨域请求
app.use(mount('/sb/', cors()))          // SB网页跨域请求
app.use(mount('/dt/', cors()))          // DT网页跨域请求
app.use(mount('/pp/', cors()))          // PP网页跨域请求
app.use(mount('/haba/', cors()))        // HABA网页跨域请求
app.use(mount('/pg/', cors()))          // PG网页跨域请求
app.use(mount('/png/', cors()))         // PNG网页跨域请求
app.use(mount('/vg/', cors()))          // VG网页跨域请求

// app.use(mount('/ky/', cors()))          // KY网页跨域请求
// app.use(mount('/ug/', cors()))          // UG网页跨域请求
// app.use(mount('/cq9/', cors()))         // CQ9网页跨域请求

// 入参解析
app.use(mount('/ttg/', xmlParser()))    // TTG服务入参XML解析中间件
app.use(mount('/sa/', koaBody()))       // SA服务入参TEXT解析中间件
app.use(mount('/mg/', xmlParser()))     // MG服务入参解析中间件
app.use(mount('/ag/', xmlParser()))     // AG服务入参解析中间件
app.use(mount('/ysb/', xmlParser()))    // YSB服务入参解析中间件
app.use(mount('/rtg/', koaBody()))      // RTG服务入参解析中间件
app.use(mount('/sb/', bodyParser()))    // SB服务入参解析中间件
app.use(mount('/dt/', koaBody()))       // DT服务入参解析中间件
app.use(mount('/pp/', bodyParser()))    // PP服务入参解析中间件
app.use(mount('/haba/', bodyParser()))  // HABA服务入参解析中间件
app.use(mount('/pg/', bodyParser()))    // PG服务入参解析中间件
app.use(mount('/png/', xmlParser()))    // PNG服务入参解析中间件
app.use(mount('/vg/', koaBody()))       // VG服务入参解析中间件

// app.use(mount('/ky/', bodyParser()))    // KY服务入参解析中间件
// app.use(mount('/ug/', bodyParser()))    // UG服务入参解析中间件
// app.use(mount('/cq9/', koaBody()))      // CQ9服务入参解析中间件

// 认证日志
app.use(xlog(config.log, null))     //日志中间件，参数1：日志配置，参数2：额外日志处理
// app.use(xauth(config.auth, (v) => v))   // TOKEN身份认证中间件，，参数1：认证配置，参数2：额外自定义TOKEN解析规则
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
app.use(webapirouter.routes())          // 业务路由中间件
app.use(ttgrouter.routes())             // 业务路由中间件
app.use(sarouter.routes())              // 业务路由中间件
app.use(mgrouter.routes())              // 业务路由中间件
app.use(agrouter.routes())              // 业务路由中间件
app.use(ysbrouter.routes())             // 业务路由中间件
app.use(rtgrouter.routes())             // 业务路由中间件
app.use(sbrouter.routes())              // 业务路由中间件
app.use(dtrouter.routes())              // 业务路由中间件
app.use(pprouter.routes())              // 业务路由中间件
app.use(habarouter.routes())            // 业务路由中间件
app.use(pgrouter.routes())              // 业务路由中间件
app.use(pngrouter.routes())             // 业务路由中间件
app.use(vgrouter.routes())              // 业务路由中间件

// app.use(socketrouter.routes())          // 业务路由中间件
// app.use(kyrouter.routes())              // 业务路由中间件
// app.use(ugrouter.routes())              // 业务路由中间件
// app.use(cq9router.routes())             // 业务路由中间件

// 启动应用服务
app.listen(PORT)
log.info(`API-GAME服务启动【执行环境:${process.env.NODE_ENV},端口:${PORT}，服务域名:【${config.na.apidomain}】】`)
