#工程结构
Lambda函数计算：
Hera            // 对外SDK的API

EC2主机：
api-stat        // 基础数据整理服务
api-ttg         // 第三方游戏服务

ALIYUN主机：
up-n1           // N1后台接口
up-n1-agent     // N1代理后台接口
api-visual      // 数据可视化服务

##首先设置TOKEN密钥
aws ssm put-parameter --name TOKEN_SECRET --value *** --type SecureString

##查看已设置密钥
aws ssm describe-parameters

#EC2 Docker安装
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum makecache fast
sudo yum -y install docker-ce
systemctl start docker

#图片前缀
国外：http://img.na77.com/TTG_526.png
国内：http://app.risheng3d.com/game/ttggame/lobby_bg.jpg

#主机服务
一、安装NGINX
vi /etc/yum.repos.d/nginx.repo
[nginx]
name=nginx repo
baseurl=http://nginx.org/packages/rhel/7/$basearch/
gpgcheck=0
enabled=1

二、开启SElinux支持
setsebool httpd_can_network_connect on

三、启动NGINX
yum install nginx
systemctl start nginx
systemctl stop nginx
systemctl restart nginx
systemctl status nginx

四、NGINX配置
vi /etc/nginx/conf.d/ext.na77.org.conf
server {
    listen	80;
    ignore_invalid_headers off;
    server_name ext.na77.org 13.229.74.10;

    ## gzip setting
    gzip on;
    gzip_disable "msie6";

    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    #自动构建服务
    location /deploy/ {
        proxy_pass http://localhost:4000/deploy/;
    }
    #静态资源
    location /static/ {
        proxy_pass http://localhost:3000/static/;
    }
    #页游大厅服务
    location /webapi/ {
        proxy_pass http://localhost:3000/webapi/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #可视化服务
    location /visual/ {
        proxy_pass http://localhost:5000/visual/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #TTG服务
    location /ttg/ {
        allow 27.126.228.114;	#TTG服务器
        allow 47.88.192.69;     #大厅服务器
        allow 119.4.254.86;     #测试电脑
        deny  all;
        proxy_pass http://localhost:3000/ttg/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #SA服务
    location /sa/ {
        proxy_pass http://localhost:3000/sa/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #CQ9服务
    location /cq9/ {
        proxy_pass http://localhost:3000/cq9/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #MG服务
    location /mg/ {
        proxy_pass http://localhost:3000/mg/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #AG服务
    location /ag/ {
        proxy_pass http://localhost:3000/ag/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #VG服务
    location /vg/ {
        proxy_pass http://localhost:3000/vg/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #YSB服务
    location /ysb/ {
        proxy_pass http://localhost:3000/ysb/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #RTG服务
    location /rtg/ {
        proxy_pass http://localhost:3000/rtg/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #SB服务
    location /sb/ {
        proxy_pass http://localhost:3000/sb/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #DT服务
    location /dt/ {
        proxy_pass http://localhost:3000/dt/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #PP服务
    location /pp/ {
        proxy_pass http://localhost:3000/pp/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #HABA服务
    location /haba/ {
        proxy_pass http://localhost:3000/haba/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #KY服务
    location /ky/ {
        proxy_pass http://localhost:3000/ky/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #PG服务
    location /pg/ {
        proxy_pass http://localhost:3000/pg/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #PNG服务
    location /png/ {
        proxy_pass http://localhost:3000/png/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #DJ服务
    location /dj/ {
        proxy_pass http://localhost:3000/dj/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    #长连接服务
    location /socket/ {
        proxy_pass http://localhost:3000/socket/;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Host $host;
    }
}

五、开启RHEL7的certbot
rpm -Uvh http://ftp.linux.ncsu.edu/pub/epel/7/x86_64/e/epel-release-7-9.noarch.rpm
yum -y install yum-utils
yum-config-manager --enable rhui-REGION-rhel-server-extras rhui-REGION-rhel-server-optional
yum install certbot-nginx
certbot --nginx

六、设置环境变量
export NODE_ENV=production

pm2 start app.js --node-args="--max-old-space-size=16384 --optimize-for-size" --max-memory-restart 16384M -n stat --env production

七、正式服调整TCP最大连接数量
ulimit -n

八、
用下面的命令在远程主机生成public key
$ ssh-keygen -t rsa
cat ~/.ssh/id_rsa.pub  将输出的密钥复制到github的deploykey上，远程主机就有了下载权限

需要把NULL!的战绩改成
anotherGameData{data:[{\"GameResult\":[{\"BaccaratResult\":[]}]}],mixAmount:0}

yum clean all后，需要往下面文件添加地址
rhui-load-balancers.conf
rhui2-cds01.ap-southeast-1.aws.ce.redhat.com
rhui2-cds02.ap-southeast-1.aws.ce.redhat.com