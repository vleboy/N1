// 路由相关
const Router = require('koa-router')
const router = new Router()
// 构建相关
const exec = require('child_process').exec
// 日志相关
const config = require('config')
const log = require('tracer').colorConsole({ level: config.log.level })

const execOptions = {
    encoding: 'utf8',
    timeout: 0,
    maxBuffer: 20000 * 1024,// 最大缓存:20MB
    killSignal: 'SIGTERM',
    cwd: null,
    env: null
}

// 部署重构后台前端
router.post('/deploy/n1web', async (ctx, next) => {
    try {
        log.info('接受到请求，准备持续构建 ...')
        await gitPull('/usr/dev/N1_WEB2')
        await deployWebAdmin()
        await deployWebMerchant()
        await deployWebManager()
        await gitPull('/usr/dev/N1_WEB')
        deployWebAgent()
        // deployWebGame()
        ctx.body = 'Y'
    } catch (error) {
        log.error('自动构建发生错误异常：')
        log.error(error)
        ctx.body = 'N'
    }
})
// 部署游戏网页
router.post('/deploy/ttg', async function (ctx, next) {
    try {
        log.info('开始自动构建【第三方网页游戏】...')
        const commands = [
            'cd /usr/dev/NA_WEB/webgame',
            'git pull',
            // 亚马逊：第三方网页游戏静态资源放置
            '/usr/local/bin/aws s3 rm s3://ext.na77.org/*',
            '/usr/local/bin/aws s3 sync . s3://ext.na77.org --acl public-read --delete',
            // 阿里云：第三方网页游戏静态资源放置
            '/usr/dev/AWS_Platform/api-ttg/ossutil cp -rf . oss://webrisheng3d/',
        ].join(' && ')

        // '\cp -f /usr/dev/NA_WEB/webgame/ttg/index.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/ttg/ttg_detail.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/sa/sa.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/mg/mg.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/mg/mg_detail.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/rtg/rtg.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/dt/dt.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/dt/dt_detail.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/sb/sb_video.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/sb/sb_live.html .',
        // '\cp -f /usr/dev/NA_WEB/webgame/sb/sb_detail.html .',

        // 'npm run build-test-aws',
        // 'cd dist',

        // // TTG阿里云
        // 'cd /usr/dev/NA_WEB/ttg',
        // 'npm run build-test-aliyun',
        // 'cd dist',

        // // MG亚马逊
        // 'cd /usr/dev/NA_WEB/mg',
        // 'npm run build-test-aws',
        // 'cd dist',
        // '/usr/local/bin/aws s3 sync . s3://ext.na77.org --acl public-read',

        // // MG阿里云
        // 'cd /usr/dev/NA_WEB/mg',
        // 'npm run build-test-aliyun',
        // 'cd dist',
        // '/usr/dev/AWS_Platform/api-ttg/ossutil cp -rf . oss://webrisheng3d/'
        deploy(commands)
        ctx.body = 'Y'
    } catch (error) {
        log.error('自动构建【网页游戏】发生错误异常：')
        log.error(error)
        ctx.body = 'N'
    }
})
// 部署旧后台前端
// router.post('/deploy/na', async function (ctx, next) {
//     try {
//         log.info('接受到请求，准备持续构建 ...')
//         await gitPull('/usr/dev/NA/')
//         deployGame()
//         ctx.body = 'Y'
//     } catch (error) {
//         log.error('自动构建发生错误异常：')
//         log.error(error)
//         ctx.body = 'N'
//     }
// })
function gitPull(path) {
    return new Promise((reslove, reject) => {
        log.info('进入目录：' + path)
        const commands = [
            'cd ' + path,
            'git pull',
        ].join(' && ')
        log.info('开始执行 git pull ...')
        exec(commands, execOptions, (error, stdout, stderr) => {
            if (error) {
                log.error(`exec error: ${error}`)
                reject(error)
            }
            if (stdout) {
                log.info(`stdout: ${stdout}`)
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`)
            }
            reslove(stdout)
        })
    })
}

// 部署函数
function deployWebAdmin() {
    return new Promise((reslove, reject) => {
        const commands = [
            'cd /usr/dev/N1_WEB2/n1-admin',
            'npm run test',
            'cd dist',
            '/usr/local/bin/aws s3 rm s3://dev-admin.na12345.com/*',
            '/usr/local/bin/aws s3 sync . s3://dev-admin.na12345.com --acl public-read --delete',
        ].join(' && ')
        log.info('开始自动构建N1_WEB平台管理员系统 ...')
        exec(commands, execOptions, (error, stdout, stderr) => {
            if (error) {
                log.error(`exec error: ${error}`)
                reject(error)
            }
            if (stdout) {
                log.info(`stdout: ${stdout}`)
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`)
            }
            reslove(stdout)
        })
    })
}
function deployWebAgent() {
    return new Promise((reslove, reject) => {
        const commands = [
            'cd /usr/dev/N1_WEB/n1-agent',
            'npm run test-agent',
            'cd agent',
            '/usr/local/bin/aws s3 rm s3://dev-agent.na12345.com/*',
            '/usr/local/bin/aws s3 sync . s3://dev-agent.na12345.com --acl public-read --delete',
        ].join(' && ')
        log.info('开始自动构建N1_WEB平台代理系统 ...')
        exec(commands, execOptions, (error, stdout, stderr) => {
            if (error) {
                log.error(`exec error: ${error}`)
                reject(error)
            }
            if (stdout) {
                log.info(`stdout: ${stdout}`)
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`)
            }
            reslove(stdout)
        })
    })
}
function deployWebMerchant() {
    return new Promise((reslove, reject) => {
        const commands = [
            'cd /usr/dev/N1_WEB2/n1-merchant',
            'npm run test',
            'cd dist',
            '/usr/local/bin/aws s3 rm s3://dev-merchant.na12345.com/*',
            '/usr/local/bin/aws s3 sync . s3://dev-merchant.na12345.com --acl public-read --delete',
        ].join(' && ')
        log.info('开始自动构建N1_WEB平台商户系统 ...')
        exec(commands, execOptions, (error, stdout, stderr) => {
            if (error) {
                log.error(`exec error: ${error}`)
                reject(error)
            }
            if (stdout) {
                log.info(`stdout: ${stdout}`)
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`)
            }
            reslove(stdout)
        })
    })
}
function deployWebManager() {
    return new Promise((reslove, reject) => {
        const commands = [
            'cd /usr/dev/N1_WEB2/n1-manager',
            'npm run test',
            'cd dist',
            '/usr/local/bin/aws s3 rm s3://dev-manager.na12345.com/*',
            '/usr/local/bin/aws s3 sync . s3://dev-manager.na12345.com --acl public-read --delete',
        ].join(' && ')
        log.info('开始自动构建N1_WEB平台线路商系统 ...')
        exec(commands, execOptions, (error, stdout, stderr) => {
            if (error) {
                log.error(`exec error: ${error}`)
                reject(error)
            }
            if (stdout) {
                log.info(`stdout: ${stdout}`)
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`)
            }
            reslove(stdout)
        })
    })
}
function deployWebGame() {
    return new Promise((reslove, reject) => {
        const commands = [
            'cd /usr/dev/N1_WEB/n1-game',
            'npm run test-game',
            'cd game',
            '/usr/local/bin/aws s3 rm s3://dev-game.na12345.com/*',
            '/usr/local/bin/aws s3 sync . s3://dev-game.na12345.com --acl public-read --delete',
        ].join(' && ')
        log.info('开始自动构建游戏系统 ...')
        exec(commands, execOptions, (error, stdout, stderr) => {
            if (error) {
                log.error(`exec error: ${error}`)
                reject(error)
            }
            if (stdout) {
                log.info(`stdout: ${stdout}`)
            }
            if (stderr) {
                log.error(`stderr: ${stderr}`)
            }
            reslove(stdout)
        })
    })
}
function deploy(commands) {
    exec(commands, execOptions, (error, stdout, stderr) => {
        if (error) {
            log.error(`exec error: ${error}`)
            return
        }
        if (stdout) {
            log.info(`stdout: ${stdout}`)
        }
        if (stderr) {
            log.error(`stderr: ${stderr}`)
        }
        log.info('结束自动构建')
    })
}
module.exports = router