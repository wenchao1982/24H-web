(function () {
  var status = document.getElementById("status");
  var output = document.getElementById("output");
  var pending = 0;

  function post(message) {
    message.__24os = true;
    parent.postMessage(message, "*");
  }

  function setStatus(text) {
    status.textContent = text;
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.__24os !== true) {
      return;
    }

    if (data.type === "host.init") {
      post({ type: "ui.ready" });
      setStatus("已连接宿主");
      return;
    }

    if (typeof data.id === "string") {
      if (data.ok) {
        setStatus("完成");
        output.textContent = JSON.stringify(data.result, null, 2);
      } else {
        setStatus("出错");
        output.textContent = "错误：" + ((data.error && data.error.message) || "未知错误");
      }
    }
  });

  document.getElementById("ask").addEventListener("click", function () {
    var prompt = document.getElementById("prompt").value || "你好";
    pending += 1;
    post({
      id: "req-" + Date.now() + "-" + pending,
      method: "callModel",
      params: { prompt: prompt },
    });
    setStatus("请求中…");
    output.textContent = "";
  });
})();
