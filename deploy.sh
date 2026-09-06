#!/bin/bash

# Màu sắc cho output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}   MINH PORTFOLIO - SMART DOCKER DEPLOYMENT WIZARD   ${NC}"
echo -e "${BLUE}======================================================${NC}"
echo ""

# Hàm kiểm tra và cài đặt phần mềm
check_and_install() {
    local cmd=$1
    local package_name=$2
    if ! command -v $cmd &> /dev/null; then
        echo -e "${YELLOW}[CẢNH BÁO] Không tìm thấy phần mềm: '$cmd' trên hệ thống.${NC}"
        read -p "$(echo -e ${GREEN}"Bạn có muốn tự động cài đặt $package_name ngay bây giờ để tiếp tục không? (y/n): "${NC})" INSTALL_CONFIRM
        if [[ "$INSTALL_CONFIRM" == "y" || "$INSTALL_CONFIRM" == "Y" ]]; then
            echo -e "${BLUE}>>> Đang tiến hành cài đặt $package_name...${NC}"
            if command -v apt &> /dev/null; then
                sudo apt update && sudo apt install -y $package_name
            elif command -v yum &> /dev/null; then
                sudo yum update && sudo yum install -y $package_name
            else
                echo -e "${RED}[LỖI] Hệ điều hành của bạn không hỗ trợ lệnh apt/yum. Vui lòng tự cài đặt $package_name bằng tay và quay lại sau.${NC}"
                exit 1
            fi
            
            if ! command -v $cmd &> /dev/null; then
                echo -e "${RED}[LỖI] Cài đặt thất bại. Vui lòng tự cài đặt $package_name bằng tay.${NC}"
                exit 1
            fi
            echo -e "${GREEN}[THÀNH CÔNG] Đã cài đặt xong $package_name!${NC}"
        else
            echo -e "${RED}[LỖI] Cần có $package_name để tiếp tục. Ứng dụng xin dừng lại.${NC}"
            exit 1
        fi
    fi
}

echo -e "${GREEN}>>> BƯỚC 0: KIỂM TRA MÔI TRƯỜNG...${NC}"
check_and_install docker "docker.io"
check_and_install nginx "nginx"
echo -e "${GREEN}Môi trường đã hoàn toàn sẵn sàng!${NC}"
echo ""

# CHỌN MODE
echo -e "${YELLOW}Vui lòng chọn chế độ (Mode):${NC}"
echo "1. Cài đặt và Triển khai (Install / Deploy Mode)"
echo "2. Gỡ cài đặt và Dọn dẹp (Uninstall / Revert Mode)"
echo "3. Thoát (Exit)"
echo ""
read -p "$(echo -e ${GREEN}"Lựa chọn của bạn (1/2/3): "${NC})" MODE

DEFAULT_IMAGE_NAME="minh-portfolio"
DEFAULT_CONTAINER_NAME="portfolio-app"
DEFAULT_PORT="8080"

if [[ "$MODE" == "1" ]]; then
    # ==========================
    # CHẾ ĐỘ INSTALL MODE
    # ==========================
    echo ""
    echo -e "${BLUE}--- CHẾ ĐỘ CÀI ĐẶT & TRIỂN KHAI ---${NC}"
    read -p "$(echo -e ${YELLOW}"1. Tên Docker Image muốn tạo [Mặc định: $DEFAULT_IMAGE_NAME]: "${NC})" IMAGE_NAME
    IMAGE_NAME=${IMAGE_NAME:-$DEFAULT_IMAGE_NAME}

    read -p "$(echo -e ${YELLOW}"2. Tên Container chạy trên VPS [Mặc định: $DEFAULT_CONTAINER_NAME]: "${NC})" CONTAINER_NAME
    CONTAINER_NAME=${CONTAINER_NAME:-$DEFAULT_CONTAINER_NAME}

    read -p "$(echo -e ${YELLOW}"3. Cổng (Port) VPS mở ra ngoài để Nginx trỏ vào [Mặc định: $DEFAULT_PORT]: "${NC})" HOST_PORT
    HOST_PORT=${HOST_PORT:-$DEFAULT_PORT}

    echo ""
    echo -e "${BLUE}--- TÓM TẮT CẤU HÌNH ---${NC}"
    echo "Image Name:     $IMAGE_NAME"
    echo "Container Name: $CONTAINER_NAME"
    echo "Host Port:      $HOST_PORT -> 80 (Container)"
    echo "------------------------"

    read -p "$(echo -e ${YELLOW}"Bắt đầu quá trình Build và Deploy ngay bây giờ? (y/n): "${NC})" CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo -e "${GREEN}Đã hủy quá trình. Hẹn gặp lại!${NC}"
        exit 0
    fi

    echo ""
    echo -e "${GREEN}>>> ĐANG TIẾN HÀNH BUILD DOCKER IMAGE...${NC}"
    docker build -t "$IMAGE_NAME" .
    if [ $? -ne 0 ]; then
        echo -e "${RED}[LỖI] Build quá trình thất bại. Vui lòng kiểm tra lại log.${NC}"
        exit 1
    fi

    echo -e "${GREEN}>>> BUILD THÀNH CÔNG! ĐANG KHỞI CHẠY CONTAINER...${NC}"
    if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
        echo -e "${YELLOW}Container '$CONTAINER_NAME' đã tồn tại. Đang xóa cái cũ để ghi đè...${NC}"
        docker rm -f "$CONTAINER_NAME"
    fi

    docker run -d -p "$HOST_PORT":80 --name "$CONTAINER_NAME" "$IMAGE_NAME"

    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}🎉 DEPLOY HOÀN TẤT! 🎉${NC}"
        echo -e "Website đang chạy ngầm trên VPS tại cổng: ${BLUE}$HOST_PORT${NC}"
        echo -e "Bạn có thể kiểm tra nội bộ bằng lệnh: ${YELLOW}curl http://localhost:$HOST_PORT${NC}"
        
        echo ""
        read -p "$(echo -e ${YELLOW}"Bạn có muốn cấu hình Nginx TỰ ĐỘNG để trỏ Domain không? (y/n): "${NC})" NGINX_CONFIRM
        if [[ "$NGINX_CONFIRM" == "y" || "$NGINX_CONFIRM" == "Y" ]]; then
            read -p "$(echo -e ${YELLOW}"Nhập tên miền của bạn (Ví dụ: minh-portfolio.com hoặc sub.domain.com): "${NC})" DOMAIN_NAME
            if [[ -n "$DOMAIN_NAME" ]]; then
                
                read -p "$(echo -e ${YELLOW}"Tên miền này có kèm theo alias 'www' (www.$DOMAIN_NAME) không? (Chọn 'n' nếu đây là Subdomain): (y/n) "${NC})" INCLUDE_WWW
                if [[ "$INCLUDE_WWW" == "y" || "$INCLUDE_WWW" == "Y" ]]; then
                    SERVER_NAMES="$DOMAIN_NAME www.$DOMAIN_NAME"
                    CERTBOT_DOMAINS="-d $DOMAIN_NAME -d www.$DOMAIN_NAME"
                    DNS_WWW_MSG="2. Record Type: ${BLUE}A${NC} (hoặc CNAME) | Name/Host: ${BLUE}www${NC} | Value: ${BLUE}[IP_CỦA_VPS_NÀY]${NC} (hoặc $DOMAIN_NAME)"
                else
                    SERVER_NAMES="$DOMAIN_NAME"
                    CERTBOT_DOMAINS="-d $DOMAIN_NAME"
                    DNS_WWW_MSG=""
                fi
                
                NGINX_CONF_PATH=""
                NGINX_LINK_PATH=""
                if [ -d "/etc/nginx/sites-available" ]; then
                    NGINX_CONF_PATH="/etc/nginx/sites-available/$DOMAIN_NAME"
                    NGINX_LINK_PATH="/etc/nginx/sites-enabled/$DOMAIN_NAME"
                elif [ -d "/etc/nginx/conf.d" ]; then
                    NGINX_CONF_PATH="/etc/nginx/conf.d/$DOMAIN_NAME.conf"
                else
                    echo -e "${RED}[LỖI] Không tìm thấy thư mục cấu hình Nginx chuẩn. Bỏ qua cấu hình tự động.${NC}"
                fi

                if [[ -n "$NGINX_CONF_PATH" ]]; then
                    echo -e "${BLUE}>>> Đang tạo cấu hình Nginx cho $DOMAIN_NAME...${NC}"
                    sudo bash -c "cat > $NGINX_CONF_PATH" <<EOF
server {
    listen 80;
    server_name $SERVER_NAMES;

    location / {
        proxy_pass http://localhost:$HOST_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
                    if [[ -n "$NGINX_LINK_PATH" ]]; then
                        sudo ln -sf "$NGINX_CONF_PATH" "$NGINX_LINK_PATH"
                    fi
                    
                    sudo systemctl reload nginx || sudo service nginx reload
                    echo -e "${GREEN}[THÀNH CÔNG] Đã cấu hình Nginx tự động!${NC}"
                    
                    echo ""
                    echo -e "${YELLOW}========================================================================${NC}"
                    echo -e "${GREEN} HƯỚNG DẪN CẤU HÌNH DNS TÊN MIỀN (DOMAIN DNS SETUP)${NC}"
                    echo -e "${YELLOW}========================================================================${NC}"
                    echo -e "Để website hoạt động trên internet, hãy truy cập trang quản lý DNS của"
                    echo -e "nhà cung cấp tên miền (Cloudflare, GoDaddy...) và thêm 2 bản ghi sau:"
                    echo -e "1. Record Type: ${BLUE}A${NC} | Name/Host: ${BLUE}@${NC} (hoặc $DOMAIN_NAME) | Value: ${BLUE}[IP_CỦA_VPS_NÀY]${NC}"
                    if [[ -n "$DNS_WWW_MSG" ]]; then
                        echo -e "$DNS_WWW_MSG"
                    fi
                    echo -e "Lưu ý: Bạn có thể lấy IP của VPS bằng lệnh: ${BLUE}curl ifconfig.me${NC}"
                    echo -e "${YELLOW}========================================================================${NC}"
                    
                    echo ""
                    read -p "$(echo -e ${YELLOW}"[QUAN TRỌNG] Bạn đã trỏ tên miền (DNS) về IP của VPS này thành công chưa? Nếu đã trỏ, bạn có muốn Cài đặt Bảo mật SSL/HTTPS (Let's Encrypt) TỰ ĐỘNG không? (y/n): "${NC})" SSL_CONFIRM
                    if [[ "$SSL_CONFIRM" == "y" || "$SSL_CONFIRM" == "Y" ]]; then
                        read -p "$(echo -e ${YELLOW}"Nhập địa chỉ Email của bạn (để Let's Encrypt gửi thông báo gia hạn SSL): "${NC})" EMAIL_ADDRESS
                        
                        echo -e "${BLUE}>>> Đang cài đặt Certbot...${NC}"
                        if command -v apt &> /dev/null; then
                            sudo apt update && sudo apt install -y certbot python3-certbot-nginx
                        elif command -v yum &> /dev/null; then
                            sudo yum install -y epel-release
                            sudo yum install -y certbot python3-certbot-nginx
                        fi
                        
                        if command -v certbot &> /dev/null; then
                            echo -e "${BLUE}>>> Đang xin cấp chứng chỉ SSL và cấu hình Nginx tự động...${NC}"
                            if [[ -n "$EMAIL_ADDRESS" ]]; then
                                sudo certbot --nginx $CERTBOT_DOMAINS --non-interactive --agree-tos -m "$EMAIL_ADDRESS" --redirect
                            else
                                sudo certbot --nginx $CERTBOT_DOMAINS --non-interactive --agree-tos --register-unsafely-without-email --redirect
                            fi
                            
                            if [ $? -eq 0 ]; then
                                echo -e "${GREEN}[THÀNH CÔNG] Đã bật HTTPS an toàn cho tên miền của bạn!${NC}"
                                echo -e "Bây giờ bạn có thể truy cập bằng: ${BLUE}https://$DOMAIN_NAME${NC}"
                            else
                                echo -e "${RED}[LỖI] Không thể cấp SSL. Có thể do tên miền chưa được trỏ IP kịp thời, vui lòng chờ DNS cập nhật và tự chạy lệnh certbot sau.${NC}"
                            fi
                        else
                            echo -e "${RED}[LỖI] Không thể tự động cài đặt Certbot trên hệ thống của bạn.${NC}"
                        fi
                    else
                        echo -e "${YELLOW}[THÔNG BÁO] Bỏ qua cài đặt SSL. Bạn có thể tự cài đặt sau bằng tay.${NC}"
                    fi
                fi
            fi
        fi
    else
        echo -e "${RED}[LỖI] Khởi chạy container thất bại.${NC}"
    fi

elif [[ "$MODE" == "2" ]]; then
    # ==========================
    # CHẾ ĐỘ UNINSTALL MODE
    # ==========================
    echo ""
    echo -e "${BLUE}--- CHẾ ĐỘ GỠ CÀI ĐẶT & DỌN DẸP ---${NC}"
    read -p "$(echo -e ${YELLOW}"Nhập Tên Container cần gỡ bỏ [Mặc định: $DEFAULT_CONTAINER_NAME]: "${NC})" CONTAINER_NAME
    CONTAINER_NAME=${CONTAINER_NAME:-$DEFAULT_CONTAINER_NAME}

    read -p "$(echo -e ${YELLOW}"Nhập Tên Image cần gỡ bỏ [Mặc định: $DEFAULT_IMAGE_NAME]: "${NC})" IMAGE_NAME
    IMAGE_NAME=${IMAGE_NAME:-$DEFAULT_IMAGE_NAME}

    read -p "$(echo -e ${YELLOW}"Nhập Tên Miền (Domain) đã cấu hình (Để trống nếu không có): "${NC})" DOMAIN_NAME

    echo ""
    read -p "$(echo -e ${RED}"[CẢNH BÁO] Việc này sẽ DỪNG và XÓA HOÀN TOÀN container ($CONTAINER_NAME) cùng image ($IMAGE_NAME). Bạn có chắc chắn không? (y/n): "${NC})" CONFIRM
    if [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]]; then
        echo -e "${GREEN}>>> ĐANG DỪNG VÀ XÓA CONTAINER...${NC}"
        if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
            docker rm -f "$CONTAINER_NAME"
            echo -e "${GREEN}[THÀNH CÔNG] Đã xóa hoàn toàn container '$CONTAINER_NAME'.${NC}"
        else
            echo -e "${YELLOW}[THÔNG BÁO] Container '$CONTAINER_NAME' không tồn tại. Bỏ qua thao tác này.${NC}"
        fi

        echo -e "${GREEN}>>> ĐANG DỌN DẸP IMAGE CŨ...${NC}"
        if [ "$(docker images -q "$IMAGE_NAME")" ]; then
            docker rmi -f "$IMAGE_NAME"
            echo -e "${GREEN}[THÀNH CÔNG] Đã xóa sạch image '$IMAGE_NAME'.${NC}"
        else
            echo -e "${YELLOW}[THÔNG BÁO] Image '$IMAGE_NAME' không tồn tại. Bỏ qua thao tác này.${NC}"
        fi

        if [[ -n "$DOMAIN_NAME" ]]; then
            echo ""
            echo -e "${GREEN}>>> ĐANG DỌN DẸP CẤU HÌNH SSL & NGINX...${NC}"
            if command -v certbot &> /dev/null; then
                sudo certbot delete --cert-name $DOMAIN_NAME --non-interactive 2>/dev/null
                echo -e "${GREEN}[THÀNH CÔNG] Đã gỡ bỏ chứng chỉ SSL của $DOMAIN_NAME (nếu có).${NC}"
            fi
            
            if [ -f "/etc/nginx/sites-available/$DOMAIN_NAME" ]; then
                sudo rm -f "/etc/nginx/sites-available/$DOMAIN_NAME"
                sudo rm -f "/etc/nginx/sites-enabled/$DOMAIN_NAME"
                sudo systemctl reload nginx || sudo service nginx reload
                echo -e "${GREEN}[THÀNH CÔNG] Đã xóa cấu hình Nginx của $DOMAIN_NAME.${NC}"
            elif [ -f "/etc/nginx/conf.d/$DOMAIN_NAME.conf" ]; then
                sudo rm -f "/etc/nginx/conf.d/$DOMAIN_NAME.conf"
                sudo systemctl reload nginx || sudo service nginx reload
                echo -e "${GREEN}[THÀNH CÔNG] Đã xóa cấu hình Nginx của $DOMAIN_NAME.${NC}"
            else
                echo -e "${YELLOW}[THÔNG BÁO] Không tìm thấy file cấu hình Nginx của $DOMAIN_NAME.${NC}"
            fi
        fi
        
        echo ""
        echo -e "${GREEN}🎉 HOÀN TẤT GỠ CÀI ĐẶT! Không gian VPS của bạn đã được dọn sạch hoàn toàn. 🎉${NC}"
    else
        echo -e "${GREEN}Đã hủy quá trình Gỡ cài đặt.${NC}"
    fi
else
    echo -e "${GREEN}Đã thoát chương trình.${NC}"
    exit 0
fi
