# Step 1: Use Nginx as the base image
FROM nginx:alpine

# Step 2: Copy the build folder from your local machine to the Nginx container
# Make sure the build folder is in the same directory as your Dockerfile
COPY ./build /usr/share/nginx/html

# Step 3: Expose port 80 to access the app
EXPOSE 80

# Step 4: Run Nginx to serve the app
CMD ["nginx", "-g", "daemon off;"]