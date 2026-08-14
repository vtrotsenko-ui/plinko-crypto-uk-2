/**
 * Plinko free-play demo widget.
 *
 * IMPORTANT: this is a standalone, client-side ONLY demo:
 *  - virtual credits with no real-world value (reset any time, never
 *    withdrawable, never purchasable)
 *  - the drop path is generated with Math.random() for illustration only -
 *    it is NOT a certified or provably-fair RNG and must never be
 *    presented as one, or reused for real-money play
 *  - the payout table below is our own illustrative demo curve, not a copy
 *    of any specific real-money provider's paytable
 *
 * No network requests are made by this file.
 */
(function () {
  "use strict";

  var ROW_OPTIONS = [8, 12, 16];
  var RISK_LEVELS = ["low", "medium", "high"];
  var STARTING_BALANCE = 1000;

  // Our own illustrative demo curve - NOT copied from, or representative
  // of, any specific real-money operator's actual paytable.
  function buildPaytable(rows, risk) {
    var slots = rows + 1;
    var center = (slots - 1) / 2;
    var riskFactor = risk === "low" ? 1.18 : risk === "medium" ? 1.32 : 1.55;
    var table = [];
    for (var i = 0; i < slots; i++) {
      var distance = Math.abs(i - center);
      var raw = Math.pow(riskFactor, distance);
      table.push(Math.max(0.2, Math.round(raw * 10) / 10));
    }
    return table;
  }

  function simulateDrop(rows) {
    var rightMoves = 0;
    var path = [];
    for (var r = 0; r < rows; r++) {
      var goRight = Math.random() >= 0.5;
      if (goRight) rightMoves++;
      path.push(goRight ? 1 : 0);
    }
    return { slot: rightMoves, path: path };
  }

  function formatMultiplier(m) {
    return m.toFixed(1) + "x";
  }

  function initWidget(root) {
    var state = {
      rows: ROW_OPTIONS[1],
      risk: "medium",
      balance: STARTING_BALANCE,
      stake: 10,
      dropping: false,
    };

    var canvas = root.querySelector("[data-plinko-canvas]");
    var ctx = canvas.getContext("2d");
    var balanceEl = root.querySelector("[data-plinko-balance]");
    var resultEl = root.querySelector("[data-plinko-result]");
    var stakeInput = root.querySelector("[data-plinko-stake]");
    var dropBtn = root.querySelector("[data-plinko-drop]");
    var resetBtn = root.querySelector("[data-plinko-reset]");
    var rowSelect = root.querySelector("[data-plinko-rows]");
    var riskSelect = root.querySelector("[data-plinko-risk]");
    var paytableEl = root.querySelector("[data-plinko-paytable]");

    function updateBalanceDisplay() {
      balanceEl.textContent = state.balance.toFixed(0) + " demo credits";
    }

    function renderPaytable() {
      var table = buildPaytable(state.rows, state.risk);
      paytableEl.innerHTML = table
        .map(function (m) {
          return '<span class="plinko-slot-chip">' + formatMultiplier(m) + "</span>";
        })
        .join("");
      return table;
    }

    function drawBoard(ballSlot, ballRowProgress) {
      var w = canvas.width;
      var h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f7f5ef";
      ctx.fillRect(0, 0, w, h);

      var rows = state.rows;
      var topMargin = 24;
      var bottomMargin = 46;
      var rowHeight = (h - topMargin - bottomMargin) / rows;
      var pegRadius = 3;

      ctx.fillStyle = "#c9c4b4";
      for (var r = 0; r < rows; r++) {
        var pegsInRow = r + 2;
        var y = topMargin + r * rowHeight;
        var spacing = w / (pegsInRow + 1);
        for (var p = 0; p < pegsInRow; p++) {
          var x = spacing * (p + 1);
          ctx.beginPath();
          ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Slots
      var slots = rows + 1;
      var slotWidth = w / slots;
      var table = buildPaytable(rows, state.risk);
      for (var s = 0; s < slots; s++) {
        ctx.fillStyle = s === ballSlot && ballRowProgress >= rows ? "#3a5a9b" : "#e7e2d3";
        ctx.fillRect(s * slotWidth + 1, h - bottomMargin + 6, slotWidth - 2, bottomMargin - 10);
        ctx.fillStyle = "#1f2430";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(formatMultiplier(table[s]), s * slotWidth + slotWidth / 2, h - 12);
      }

      if (ballRowProgress !== null && ballRowProgress < rows + 1) {
        var progressClamped = Math.min(ballRowProgress, rows);
        var ballY = topMargin + progressClamped * rowHeight;
        var fraction = Math.min(1, ballRowProgress);
        var pegsAtRow = Math.floor(progressClamped) + 2;
        var spacingAtRow = w / (pegsAtRow + 1);
        var ballX = spacingAtRow * (ballSlot + 1) * (progressClamped / rows) + w / 2 * (1 - progressClamped / rows);
        ctx.fillStyle = "#c0392b";
        ctx.beginPath();
        ctx.arc(ballX, ballY, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function animateDrop(finalSlot, path) {
      state.dropping = true;
      dropBtn.disabled = true;
      var step = 0;
      var totalSteps = state.rows;
      var runningRight = 0;

      function frame() {
        if (step > totalSteps) {
          state.dropping = false;
          dropBtn.disabled = false;
          var table = buildPaytable(state.rows, state.risk);
          var multiplier = table[finalSlot];
          var winnings = Math.round(state.stake * multiplier * 100) / 100;
          state.balance = Math.max(0, state.balance - state.stake + winnings);
          updateBalanceDisplay();
          resultEl.textContent =
            "Ball landed in slot " + (finalSlot + 1) + " - multiplier " + formatMultiplier(multiplier) + " - result: " +
            (winnings >= state.stake ? "+" : "") + (winnings - state.stake).toFixed(2) + " demo credits";
          drawBoard(finalSlot, totalSteps + 1);
          return;
        }
        if (step > 0 && step <= totalSteps) runningRight += path[step - 1];
        var approxSlotSoFar = step === 0 ? state.rows / 2 : runningRight;
        drawBoard(Math.round(approxSlotSoFar), step);
        step++;
        setTimeout(function () {
          requestAnimationFrame(frame);
        }, 90);
      }
      requestAnimationFrame(frame);
    }

    function handleDrop() {
      if (state.dropping) return;
      var stakeValue = Math.max(1, Math.min(state.balance, Number(stakeInput.value) || 0));
      if (stakeValue <= 0 || state.balance <= 0) {
        resultEl.textContent = "Add demo credits by resetting the balance below, or lower your stake.";
        return;
      }
      state.stake = stakeValue;
      resultEl.textContent = "Dropping...";
      var result = simulateDrop(state.rows);
      animateDrop(result.slot, result.path);
    }

    function handleReset() {
      state.balance = STARTING_BALANCE;
      resultEl.textContent = "Demo balance reset - this never was, and never will be, real money.";
      updateBalanceDisplay();
      drawBoard(Math.round(state.rows / 2), null);
    }

    rowSelect.addEventListener("change", function () {
      state.rows = Number(rowSelect.value);
      renderPaytable();
      drawBoard(Math.round(state.rows / 2), null);
    });
    riskSelect.addEventListener("change", function () {
      state.risk = riskSelect.value;
      renderPaytable();
      drawBoard(Math.round(state.rows / 2), null);
    });
    dropBtn.addEventListener("click", handleDrop);
    resetBtn.addEventListener("click", handleReset);

    renderPaytable();
    updateBalanceDisplay();
    drawBoard(Math.round(state.rows / 2), null);
  }

  function init() {
    var widgets = document.querySelectorAll("[data-plinko-widget]");
    for (var i = 0; i < widgets.length; i++) initWidget(widgets[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
