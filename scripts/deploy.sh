#!/bin/bash

# SillyTavern 角色卡中心 - 云服务器部署脚本
# 使用方法: ./scripts/deploy.sh [环境]
# 环境选项: dev, prod (默认: prod)

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
ENVIRONMENT=${1:-prod}
PROJECT_NAME="sillytavern-card"
DOCKER_COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 创建必要目录
create_directories() {
    log_info "创建必要目录..."
    
    mkdir -p data/public/characters
    mkdir -p public/characters
    mkdir -p backups
    mkdir -p ssl
    
    log_success "目录创建完成"
}

# 备份现有数据
backup_data() {
    if [ -d "data" ] && [ "$(ls -A data)" ]; then
        log_info "备份现有数据..."
        
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        tar -czf "$BACKUP_DIR/$BACKUP_FILE" data/
        
        log_success "数据已备份到: $BACKUP_DIR/$BACKUP_FILE"
    fi
}

# 构建和启动服务
deploy_services() {
    log_info "开始部署服务..."
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose down || true
    
    # 构建镜像
    log_info "构建 Docker 镜像..."
    docker-compose build --no-cache
    
    # 启动服务
    log_info "启动服务..."
    if [ "$ENVIRONMENT" = "prod" ]; then
        docker-compose up -d
    else
        docker-compose up -d app
    fi
    
    log_success "服务启动完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    # 等待服务启动
    sleep 10
    
    # 检查应用是否响应
    if curl -f http://localhost:3000/api/index > /dev/null 2>&1; then
        log_success "应用健康检查通过"
    else
        log_warning "应用可能未完全启动，请稍后检查"
    fi
}

# 显示部署信息
show_deployment_info() {
    log_success "部署完成！"
    echo ""
    echo "=== 部署信息 ==="
    echo "项目名称: $PROJECT_NAME"
    echo "环境: $ENVIRONMENT"
    echo "应用地址: http://localhost:3000"
    echo "Nginx 地址: http://localhost:80"
    echo ""
    echo "=== 管理命令 ==="
    echo "查看日志: docker-compose logs -f"
    echo "停止服务: docker-compose down"
    echo "重启服务: docker-compose restart"
    echo "更新服务: ./scripts/deploy.sh $ENVIRONMENT"
    echo ""
    echo "=== 数据目录 ==="
    echo "角色卡数据: ./data/public/characters"
    echo "备份文件: ./backups"
    echo ""
}

# 清理函数
cleanup() {
    if [ $? -ne 0 ]; then
        log_error "部署过程中出现错误"
        log_info "正在清理..."
        docker-compose down || true
    fi
}

# 设置清理陷阱
trap cleanup EXIT

# 主函数
main() {
    log_info "开始部署 SillyTavern 角色卡中心..."
    log_info "环境: $ENVIRONMENT"
    
    check_dependencies
    create_directories
    backup_data
    deploy_services
    health_check
    show_deployment_info
    
    log_success "部署完成！"
}

# 运行主函数
main "$@"
