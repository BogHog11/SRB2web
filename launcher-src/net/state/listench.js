class ListenChannel {
  constructor(url, id, ip) {
    this.url = url;
    this.id = id;
    this.ip = ip;
    this.socket = new WebSocket(url);
    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleClose.bind(this);

    this.isOpen = false;
  }

  handleOpen() {
    var { socket } = this;
    this.isOpen = true;
  }

  handleMessage(event) {
    var { socket } = this;
    if (this.ondata) {
      this.ondata(event.data);
    }
  }

  handleClose() {
    var { socket } = this;
    this.isOpen = false;
    if (this.requestDispose) {
      this.requestDispose();
    }
  }

  dispose() {
    if (this.isOpen) {
      this.socket.onclose = () => {};
      this.isOpen = false;
      this.socket.close();
    }
    this.socket = null;
    this.requestDispose = null;
  }

  send(data) {
    var { socket } = this;
    if (!this.isOpen) {
      return;
    }
    if (!socket) {
      return;
    }
    socket.send(data);
  }
}

module.exports = ListenChannel;
