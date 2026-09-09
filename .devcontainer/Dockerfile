FROM mcr.microsoft.com/devcontainers/base:ubuntu

# System dependencies + locale
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    tmux \
    curl \
    locales \
    && rm -rf /var/lib/apt/lists/* \
    && locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8
ENV TERM=xterm-256color

# Install Node 24 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm@10

# Install Claude Code (as vscode user so it lands on their PATH)
USER vscode
RUN curl -fsSL https://claude.ai/install.sh | bash
USER root

# Copy tmux config
COPY .tmux.conf /tmp/.tmux.conf
RUN cp /tmp/.tmux.conf /root/.tmux.conf && \
    for user_home in /home/vscode /home/node; do \
      if [ -d "$user_home" ]; then \
        cp /tmp/.tmux.conf "$user_home/.tmux.conf" && \
        chown "$(stat -c '%U:%G' "$user_home")" "$user_home/.tmux.conf"; \
      fi; \
    done && \
    rm /tmp/.tmux.conf
