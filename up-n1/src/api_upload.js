// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const AWS = require('aws-sdk')
const OSS = require('ali-oss')
const IMG_BUCKET = config.env.IMG_BUCKET
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const BizErr = require('./lib/Codes').BizErr


// 上传图片
router.post('/upload', async function (ctx, next) {
    let inparam = ctx.request.body
    if (!inparam.contentType) {
        throw BizErr.InparamErr('Missing contentType')
    }
    if (!inparam.filePath) {
        throw BizErr.InparamErr('Missing filePath')
    }
    const params = {
        Bucket: IMG_BUCKET,
        Key: inparam.filePath,
        Expires: 3600,
        ContentType: inparam.contentType
    }
    let p1 = new Promise(function (resolve, reject) {
        new AWS.S3().getSignedUrl('putObject', params, (err, url) => {
            if (err) {
                reject(err.message)
            } else {
                resolve({ "aws": url })
            }
        })
    })
    let p2 = new Promise(async function (resolve, reject) {
        let STS = OSS.STS
        let sts = new STS({
            accessKeyId: 'LTAImEnvvESnBdV5',
            accessKeySecret: 'BaQfbS3EeiqKZRjKjSEU6PGp0IUwGs'
        })
        let rolearn = 'acs:ram::1503814185243023:role/aliyunosstokengeneratorrole'
        let policy = {
            "Statement": [
                {
                    "Action": "oss:*",
                    "Effect": "Allow",
                    "Resource": "*"
                }
            ],
            "Version": "1"
        }
        let token = await sts.assumeRole(rolearn, policy, 15 * 60, 'taoosossss')
        resolve({ "ali": token.credentials })
    })

    let finalRes = await Promise.all([p1, p2]).catch(err => {
        console.log(err)
    })
    // 返回结果
    ctx.body = { code: 0, payload: finalRes }
})

module.exports = router