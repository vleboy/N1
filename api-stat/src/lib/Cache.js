const redis = require('redis')

class Cache {
    constructor(config) {
        this.redisClient = redis.createClient({ url: 'redis://redis-19126.c1.ap-southeast-1-1.ec2.cloud.redislabs.com:19126' })
    }
    get(key) {
        return new Promise((resolve, reject) => {
            this.redisClient.get(key, function (err, res) {
                if (err) {
                    reject(err)
                } else {
                    let obj = JSON.parse(res || '{}')
                    if (obj.expire && obj.expire < Date.now()) {
                        obj = {}
                    }
                    resolve(obj)
                }
            })
        })
    }
    set(key, obj) {
        return new Promise((resolve, reject) => {
            this.redisClient.set(key, JSON.stringify(obj), function (err, res) {
                if (err) {
                    reject(err)
                } else {
                    resolve(res)
                }
            })
        })
    }
    quit() {
        this.redisClient.quit()
    }
    flushdb() {
        this.redisClient.flushdb()
    }
    flushall() {
        this.redisClient.flushall()
    }
    keys() {
        return new Promise((resolve, reject) => {
            this.redisClient.keys('*', function (err, res) {
                if (err) {
                    reject(err)
                } else {
                    resolve(res)
                }
            })
        })
    }
}

module.exports = Cache