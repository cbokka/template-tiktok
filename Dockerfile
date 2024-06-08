# Use the official Node.js 21.5.0 image as the base image
FROM node:21.5.0

# Install Chromium and dependencies
RUN apt-get update && apt-get install -y chromium ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 xdg-utils wget

RUN apt-get update && apt-get install -y \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*
    
# Create and change to the app directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Create the symlink inside the /usr/src/app/public directory
RUN mkdir -p /usr/src/app
RUN if [ ! -L /usr/src/app ]; then ln -s /mnt/disks/bbnews/public /usr/src/app; fi

# Expose the port the app runs on
EXPOSE 3001

# Run the application
CMD [ "node", "cloudrunFinalVideoRenderServer.js" ]