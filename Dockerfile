# Use the official lightweight Nginx image
FROM nginx:alpine

# Copy all the static website files to Nginx's default HTML directory
COPY . /usr/share/nginx/html

# Expose port 80 for web traffic
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
