# Use the official Node.js 21.5.0 image as the base image
FROM node:21.5.0

# Install Chromium
RUN apt-get update && apt-get install -y chromium

# Create the necessary directories
RUN mkdir -p /mnt/disks/bbnews/public /usr/src/app /usr/src/app/public/output

# Create the symlink
RUN if [ ! -L /usr/src/app/public ]; then ln -s /mnt/disks/bbnews/public /usr/src/app/public; fi

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files
COPY package*.json ./

# Install the dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001

# Run the application
CMD [ "node", "cloudrunFinalVideoRenderServer.js" ]