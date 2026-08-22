// @ts-nocheck — Doner প্যানেলের (src/pages/Doner.tsx) কার্ড-ডাউনলোড সিস্টেমের verbatim
// shared port। Doner প্যানেলের working implementation-ই এখানে single source of truth —
// runtime আচরণ ১০০% অপরিবর্তিত রাখতে legacy logic-কে TypeScript টাইপ-চেকিং থেকে
// মুক্ত রাখা হয়েছে।
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  donorCard.ts — ডোনার প্রোফাইল কার্ড ডাউনলোড (Shared, single source of truth)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Doner প্যানেল ও মেইন ওয়েবসাইট — দুই জায়গাতেই ডোনার কার্ড এখান থেকেই তৈরি
 *  ও ডাউনলোড হয়, তাই একই ডোনারের কার্ড সব জায়গায় pixel-for-pixel একই:
 *
 *    • QRLIB + qrSVG()            — অফলাইনে স্ক্যানযোগ্য আসল QR কোড
 *    • vcardTextOf(subject)       — QR-এর vCard payload (স্ক্যান করলে কন্টাক্ট সেভ)
 *    • drawCardFront/Back/Tall()  — canvas-এ কার্ড আঁকা
 *                                    (ছাপানোর কার্ড ১০১৬×৬৩৮ px · শেয়ার কার্ড ৯০০×১৬০০ px)
 *    • downloadDonorCardImages()  — PNG বানিয়ে ব্রাউজারের নিজস্ব ডাউনলোড সিস্টেমে নামায়,
 *                                    টোস্ট/স্টেটাস callback সহ (Doner প্যানেলের dlCard-এর হুবহু flow)
 *    • donorCardSheetBodyHTML()   — "কার্ড নামান" sheet-এর ৩টি অপশনের একক মার্কআপ
 *    • openDonorCardDownloadSheet() — মেইন ওয়েবসাইটের জন্য একই sheet UI (নিজস্ব scoped CSS)
 *
 *  `subject` object-এর আকৃতি (সব ফিল্ড plain string/bool):
 *    { name, gender, area, phone, ageText, photo, bloodGroup, donorId,
 *      cardTheme:"green"|"red"|"dark", available:boolean, lastDonation:"YYYY-MM-DD",
 *      stat?:{t,c}, club?:{name,phone,addr,site}, logo?:string }
 *  stat/club/logo না দিলে ডিফল্ট (SITE কনফিগ + logoUrl()) বসে যায়।
 */
import SITE from "../config/site";
import { logoUrl } from "../config/logo";

  /* ---------- QR (real, scannable, offline) ---------- */
  /* QR Code Generator — (c) 2009 Kazuhiko Arase, MIT license. http://www.d-project.com/ */
  const QRLIB=(function(){
  //---------------------------------------------------------------------
  //
  // QR Code Generator for JavaScript
  //
  // Copyright (c) 2009 Kazuhiko Arase
  //
  // URL: http://www.d-project.com/
  //
  // Licensed under the MIT license:
  //  http://www.opensource.org/licenses/mit-license.php
  //
  // The word 'QR Code' is registered trademark of
  // DENSO WAVE INCORPORATED
  //  http://www.denso-wave.com/qrcode/faqpatent-e.html
  //
  //---------------------------------------------------------------------
  
  var qrcode = function() {
  
    //---------------------------------------------------------------------
    // qrcode
    //---------------------------------------------------------------------
  
    /**
     * qrcode
     * @param typeNumber 1 to 40
     * @param errorCorrectionLevel 'L','M','Q','H'
     */
    var qrcode = function(typeNumber, errorCorrectionLevel) {
  
      var PAD0 = 0xEC;
      var PAD1 = 0x11;
  
      var _typeNumber = typeNumber;
      var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
      var _modules = null;
      var _moduleCount = 0;
      var _dataCache = null;
      var _dataList = [];
  
      var _this = {};
  
      var makeImpl = function(test, maskPattern) {
  
        _moduleCount = _typeNumber * 4 + 17;
        _modules = function(moduleCount) {
          var modules = new Array(moduleCount);
          for (var row = 0; row < moduleCount; row += 1) {
            modules[row] = new Array(moduleCount);
            for (var col = 0; col < moduleCount; col += 1) {
              modules[row][col] = null;
            }
          }
          return modules;
        }(_moduleCount);
  
        setupPositionProbePattern(0, 0);
        setupPositionProbePattern(_moduleCount - 7, 0);
        setupPositionProbePattern(0, _moduleCount - 7);
        setupPositionAdjustPattern();
        setupTimingPattern();
        setupTypeInfo(test, maskPattern);
  
        if (_typeNumber >= 7) {
          setupTypeNumber(test);
        }
  
        if (_dataCache == null) {
          _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
        }
  
        mapData(_dataCache, maskPattern);
      };
  
      var setupPositionProbePattern = function(row, col) {
  
        for (var r = -1; r <= 7; r += 1) {
  
          if (row + r <= -1 || _moduleCount <= row + r) continue;
  
          for (var c = -1; c <= 7; c += 1) {
  
            if (col + c <= -1 || _moduleCount <= col + c) continue;
  
            if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
                || (0 <= c && c <= 6 && (r == 0 || r == 6) )
                || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
              _modules[row + r][col + c] = true;
            } else {
              _modules[row + r][col + c] = false;
            }
          }
        }
      };
  
      var getBestMaskPattern = function() {
  
        var minLostPoint = 0;
        var pattern = 0;
  
        for (var i = 0; i < 8; i += 1) {
  
          makeImpl(true, i);
  
          var lostPoint = QRUtil.getLostPoint(_this);
  
          if (i == 0 || minLostPoint > lostPoint) {
            minLostPoint = lostPoint;
            pattern = i;
          }
        }
  
        return pattern;
      };
  
      var setupTimingPattern = function() {
  
        for (var r = 8; r < _moduleCount - 8; r += 1) {
          if (_modules[r][6] != null) {
            continue;
          }
          _modules[r][6] = (r % 2 == 0);
        }
  
        for (var c = 8; c < _moduleCount - 8; c += 1) {
          if (_modules[6][c] != null) {
            continue;
          }
          _modules[6][c] = (c % 2 == 0);
        }
      };
  
      var setupPositionAdjustPattern = function() {
  
        var pos = QRUtil.getPatternPosition(_typeNumber);
  
        for (var i = 0; i < pos.length; i += 1) {
  
          for (var j = 0; j < pos.length; j += 1) {
  
            var row = pos[i];
            var col = pos[j];
  
            if (_modules[row][col] != null) {
              continue;
            }
  
            for (var r = -2; r <= 2; r += 1) {
  
              for (var c = -2; c <= 2; c += 1) {
  
                if (r == -2 || r == 2 || c == -2 || c == 2
                    || (r == 0 && c == 0) ) {
                  _modules[row + r][col + c] = true;
                } else {
                  _modules[row + r][col + c] = false;
                }
              }
            }
          }
        }
      };
  
      var setupTypeNumber = function(test) {
  
        var bits = QRUtil.getBCHTypeNumber(_typeNumber);
  
        for (var i = 0; i < 18; i += 1) {
          var mod = (!test && ( (bits >> i) & 1) == 1);
          _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
        }
  
        for (var i = 0; i < 18; i += 1) {
          var mod = (!test && ( (bits >> i) & 1) == 1);
          _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
      };
  
      var setupTypeInfo = function(test, maskPattern) {
  
        var data = (_errorCorrectionLevel << 3) | maskPattern;
        var bits = QRUtil.getBCHTypeInfo(data);
  
        // vertical
        for (var i = 0; i < 15; i += 1) {
  
          var mod = (!test && ( (bits >> i) & 1) == 1);
  
          if (i < 6) {
            _modules[i][8] = mod;
          } else if (i < 8) {
            _modules[i + 1][8] = mod;
          } else {
            _modules[_moduleCount - 15 + i][8] = mod;
          }
        }
  
        // horizontal
        for (var i = 0; i < 15; i += 1) {
  
          var mod = (!test && ( (bits >> i) & 1) == 1);
  
          if (i < 8) {
            _modules[8][_moduleCount - i - 1] = mod;
          } else if (i < 9) {
            _modules[8][15 - i - 1 + 1] = mod;
          } else {
            _modules[8][15 - i - 1] = mod;
          }
        }
  
        // fixed module
        _modules[_moduleCount - 8][8] = (!test);
      };
  
      var mapData = function(data, maskPattern) {
  
        var inc = -1;
        var row = _moduleCount - 1;
        var bitIndex = 7;
        var byteIndex = 0;
        var maskFunc = QRUtil.getMaskFunction(maskPattern);
  
        for (var col = _moduleCount - 1; col > 0; col -= 2) {
  
          if (col == 6) col -= 1;
  
          while (true) {
  
            for (var c = 0; c < 2; c += 1) {
  
              if (_modules[row][col - c] == null) {
  
                var dark = false;
  
                if (byteIndex < data.length) {
                  dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
                }
  
                var mask = maskFunc(row, col - c);
  
                if (mask) {
                  dark = !dark;
                }
  
                _modules[row][col - c] = dark;
                bitIndex -= 1;
  
                if (bitIndex == -1) {
                  byteIndex += 1;
                  bitIndex = 7;
                }
              }
            }
  
            row += inc;
  
            if (row < 0 || _moduleCount <= row) {
              row -= inc;
              inc = -inc;
              break;
            }
          }
        }
      };
  
      var createBytes = function(buffer, rsBlocks) {
  
        var offset = 0;
  
        var maxDcCount = 0;
        var maxEcCount = 0;
  
        var dcdata = new Array(rsBlocks.length);
        var ecdata = new Array(rsBlocks.length);
  
        for (var r = 0; r < rsBlocks.length; r += 1) {
  
          var dcCount = rsBlocks[r].dataCount;
          var ecCount = rsBlocks[r].totalCount - dcCount;
  
          maxDcCount = Math.max(maxDcCount, dcCount);
          maxEcCount = Math.max(maxEcCount, ecCount);
  
          dcdata[r] = new Array(dcCount);
  
          for (var i = 0; i < dcdata[r].length; i += 1) {
            dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
          }
          offset += dcCount;
  
          var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
          var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
  
          var modPoly = rawPoly.mod(rsPoly);
          ecdata[r] = new Array(rsPoly.getLength() - 1);
          for (var i = 0; i < ecdata[r].length; i += 1) {
            var modIndex = i + modPoly.getLength() - ecdata[r].length;
            ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
          }
        }
  
        var totalCodeCount = 0;
        for (var i = 0; i < rsBlocks.length; i += 1) {
          totalCodeCount += rsBlocks[i].totalCount;
        }
  
        var data = new Array(totalCodeCount);
        var index = 0;
  
        for (var i = 0; i < maxDcCount; i += 1) {
          for (var r = 0; r < rsBlocks.length; r += 1) {
            if (i < dcdata[r].length) {
              data[index] = dcdata[r][i];
              index += 1;
            }
          }
        }
  
        for (var i = 0; i < maxEcCount; i += 1) {
          for (var r = 0; r < rsBlocks.length; r += 1) {
            if (i < ecdata[r].length) {
              data[index] = ecdata[r][i];
              index += 1;
            }
          }
        }
  
        return data;
      };
  
      var createData = function(typeNumber, errorCorrectionLevel, dataList) {
  
        var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
  
        var buffer = qrBitBuffer();
  
        for (var i = 0; i < dataList.length; i += 1) {
          var data = dataList[i];
          buffer.put(data.getMode(), 4);
          buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
          data.write(buffer);
        }
  
        // calc num max data.
        var totalDataCount = 0;
        for (var i = 0; i < rsBlocks.length; i += 1) {
          totalDataCount += rsBlocks[i].dataCount;
        }
  
        if (buffer.getLengthInBits() > totalDataCount * 8) {
          throw 'code length overflow. ('
            + buffer.getLengthInBits()
            + '>'
            + totalDataCount * 8
            + ')';
        }
  
        // end code
        if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
          buffer.put(0, 4);
        }
  
        // padding
        while (buffer.getLengthInBits() % 8 != 0) {
          buffer.putBit(false);
        }
  
        // padding
        while (true) {
  
          if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break;
          }
          buffer.put(PAD0, 8);
  
          if (buffer.getLengthInBits() >= totalDataCount * 8) {
            break;
          }
          buffer.put(PAD1, 8);
        }
  
        return createBytes(buffer, rsBlocks);
      };
  
      _this.addData = function(data, mode) {
  
        mode = mode || 'Byte';
  
        var newData = null;
  
        switch(mode) {
        case 'Numeric' :
          newData = qrNumber(data);
          break;
        case 'Alphanumeric' :
          newData = qrAlphaNum(data);
          break;
        case 'Byte' :
          newData = qr8BitByte(data);
          break;
        case 'Kanji' :
          newData = qrKanji(data);
          break;
        default :
          throw 'mode:' + mode;
        }
  
        _dataList.push(newData);
        _dataCache = null;
      };
  
      _this.isDark = function(row, col) {
        if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
          throw row + ',' + col;
        }
        return _modules[row][col];
      };
  
      _this.getModuleCount = function() {
        return _moduleCount;
      };
  
      _this.make = function() {
        if (_typeNumber < 1) {
          var typeNumber = 1;
  
          for (; typeNumber < 40; typeNumber++) {
            var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
            var buffer = qrBitBuffer();
  
            for (var i = 0; i < _dataList.length; i++) {
              var data = _dataList[i];
              buffer.put(data.getMode(), 4);
              buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
              data.write(buffer);
            }
  
            var totalDataCount = 0;
            for (var i = 0; i < rsBlocks.length; i++) {
              totalDataCount += rsBlocks[i].dataCount;
            }
  
            if (buffer.getLengthInBits() <= totalDataCount * 8) {
              break;
            }
          }
  
          _typeNumber = typeNumber;
        }
  
        makeImpl(false, getBestMaskPattern() );
      };
  
      _this.createTableTag = function(cellSize, margin) {
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        var qrHtml = '';
  
        qrHtml += '<table style="';
        qrHtml += ' border-width: 0px; border-style: none;';
        qrHtml += ' border-collapse: collapse;';
        qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
        qrHtml += '">';
        qrHtml += '<tbody>';
  
        for (var r = 0; r < _this.getModuleCount(); r += 1) {
  
          qrHtml += '<tr>';
  
          for (var c = 0; c < _this.getModuleCount(); c += 1) {
            qrHtml += '<td style="';
            qrHtml += ' border-width: 0px; border-style: none;';
            qrHtml += ' border-collapse: collapse;';
            qrHtml += ' padding: 0px; margin: 0px;';
            qrHtml += ' width: ' + cellSize + 'px;';
            qrHtml += ' height: ' + cellSize + 'px;';
            qrHtml += ' background-color: ';
            qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
            qrHtml += ';';
            qrHtml += '"/>';
          }
  
          qrHtml += '</tr>';
        }
  
        qrHtml += '</tbody>';
        qrHtml += '</table>';
  
        return qrHtml;
      };
  
      _this.createSvgTag = function(cellSize, margin, alt, title) {
  
        var opts = {};
        if (typeof arguments[0] == 'object') {
          // Called by options.
          opts = arguments[0];
          // overwrite cellSize and margin.
          cellSize = opts.cellSize;
          margin = opts.margin;
          alt = opts.alt;
          title = opts.title;
        }
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        // Compose alt property surrogate
        alt = (typeof alt === 'string') ? {text: alt} : alt || {};
        alt.text = alt.text || null;
        alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;
  
        // Compose title property surrogate
        title = (typeof title === 'string') ? {text: title} : title || {};
        title.text = title.text || null;
        title.id = (title.text) ? title.id || 'qrcode-title' : null;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var c, mc, r, mr, qrSvg='', rect;
  
        rect = 'l' + cellSize + ',0 0,' + cellSize +
          ' -' + cellSize + ',0 0,-' + cellSize + 'z ';
  
        qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
        qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
        qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
        qrSvg += ' preserveAspectRatio="xMinYMin meet"';
        qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
            escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
        qrSvg += '>';
        qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
            escapeXml(title.text) + '</title>' : '';
        qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
            escapeXml(alt.text) + '</description>' : '';
        qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
        qrSvg += '<path d="';
  
        for (r = 0; r < _this.getModuleCount(); r += 1) {
          mr = r * cellSize + margin;
          for (c = 0; c < _this.getModuleCount(); c += 1) {
            if (_this.isDark(r, c) ) {
              mc = c*cellSize+margin;
              qrSvg += 'M' + mc + ',' + mr + rect;
            }
          }
        }
  
        qrSvg += '" stroke="transparent" fill="black"/>';
        qrSvg += '</svg>';
  
        return qrSvg;
      };
  
      _this.createDataURL = function(cellSize, margin) {
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
  
        return createDataURL(size, size, function(x, y) {
          if (min <= x && x < max && min <= y && y < max) {
            var c = Math.floor( (x - min) / cellSize);
            var r = Math.floor( (y - min) / cellSize);
            return _this.isDark(r, c)? 0 : 1;
          } else {
            return 1;
          }
        } );
      };
  
      _this.createImgTag = function(cellSize, margin, alt) {
  
        cellSize = cellSize || 2;
        margin = (typeof margin == 'undefined')? cellSize * 4 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
  
        var img = '';
        img += '<img';
        img += '\u0020src="';
        img += _this.createDataURL(cellSize, margin);
        img += '"';
        img += '\u0020width="';
        img += size;
        img += '"';
        img += '\u0020height="';
        img += size;
        img += '"';
        if (alt) {
          img += '\u0020alt="';
          img += escapeXml(alt);
          img += '"';
        }
        img += '/>';
  
        return img;
      };
  
      var escapeXml = function(s) {
        var escaped = '';
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charAt(i);
          switch(c) {
          case '<': escaped += '&lt;'; break;
          case '>': escaped += '&gt;'; break;
          case '&': escaped += '&amp;'; break;
          case '"': escaped += '&quot;'; break;
          default : escaped += c; break;
          }
        }
        return escaped;
      };
  
      var _createHalfASCII = function(margin) {
        var cellSize = 1;
        margin = (typeof margin == 'undefined')? cellSize * 2 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
  
        var y, x, r1, r2, p;
  
        var blocks = {
          '██': '█',
          '█ ': '▀',
          ' █': '▄',
          '  ': ' '
        };
  
        var blocksLastLineNoMargin = {
          '██': '▀',
          '█ ': '▀',
          ' █': ' ',
          '  ': ' '
        };
  
        var ascii = '';
        for (y = 0; y < size; y += 2) {
          r1 = Math.floor((y - min) / cellSize);
          r2 = Math.floor((y + 1 - min) / cellSize);
          for (x = 0; x < size; x += 1) {
            p = '█';
  
            if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
              p = ' ';
            }
  
            if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
              p += ' ';
            }
            else {
              p += '█';
            }
  
            // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
            ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
          }
  
          ascii += '\n';
        }
  
        if (size % 2 && margin > 0) {
          return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
        }
  
        return ascii.substring(0, ascii.length-1);
      };
  
      _this.createASCII = function(cellSize, margin) {
        cellSize = cellSize || 1;
  
        if (cellSize < 2) {
          return _createHalfASCII(margin);
        }
  
        cellSize -= 1;
        margin = (typeof margin == 'undefined')? cellSize * 2 : margin;
  
        var size = _this.getModuleCount() * cellSize + margin * 2;
        var min = margin;
        var max = size - margin;
  
        var y, x, r, p;
  
        var white = Array(cellSize+1).join('██');
        var black = Array(cellSize+1).join('  ');
  
        var ascii = '';
        var line = '';
        for (y = 0; y < size; y += 1) {
          r = Math.floor( (y - min) / cellSize);
          line = '';
          for (x = 0; x < size; x += 1) {
            p = 1;
  
            if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
              p = 0;
            }
  
            // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
            line += p ? white : black;
          }
  
          for (r = 0; r < cellSize; r += 1) {
            ascii += line + '\n';
          }
        }
  
        return ascii.substring(0, ascii.length-1);
      };
  
      _this.renderTo2dContext = function(context, cellSize) {
        cellSize = cellSize || 2;
        var length = _this.getModuleCount();
        for (var row = 0; row < length; row++) {
          for (var col = 0; col < length; col++) {
            context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
            context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
        }
      }
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrcode.stringToBytes
    //---------------------------------------------------------------------
  
    qrcode.stringToBytesFuncs = {
      'default' : function(s) {
        var bytes = [];
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charCodeAt(i);
          bytes.push(c & 0xff);
        }
        return bytes;
      }
    };
  
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];
  
    //---------------------------------------------------------------------
    // qrcode.createStringToBytes
    //---------------------------------------------------------------------
  
    /**
     * @param unicodeData base64 string of byte array.
     * [16bit Unicode],[16bit Bytes], ...
     * @param numChars
     */
    qrcode.createStringToBytes = function(unicodeData, numChars) {
  
      // create conversion map.
  
      var unicodeMap = function() {
  
        var bin = base64DecodeInputStream(unicodeData);
        var read = function() {
          var b = bin.read();
          if (b == -1) throw 'eof';
          return b;
        };
  
        var count = 0;
        var unicodeMap = {};
        while (true) {
          var b0 = bin.read();
          if (b0 == -1) break;
          var b1 = read();
          var b2 = read();
          var b3 = read();
          var k = String.fromCharCode( (b0 << 8) | b1);
          var v = (b2 << 8) | b3;
          unicodeMap[k] = v;
          count += 1;
        }
        if (count != numChars) {
          throw count + ' != ' + numChars;
        }
  
        return unicodeMap;
      }();
  
      var unknownChar = '?'.charCodeAt(0);
  
      return function(s) {
        var bytes = [];
        for (var i = 0; i < s.length; i += 1) {
          var c = s.charCodeAt(i);
          if (c < 128) {
            bytes.push(c);
          } else {
            var b = unicodeMap[s.charAt(i)];
            if (typeof b == 'number') {
              if ( (b & 0xff) == b) {
                // 1byte
                bytes.push(b);
              } else {
                // 2bytes
                bytes.push(b >>> 8);
                bytes.push(b & 0xff);
              }
            } else {
              bytes.push(unknownChar);
            }
          }
        }
        return bytes;
      };
    };
  
    //---------------------------------------------------------------------
    // QRMode
    //---------------------------------------------------------------------
  
    var QRMode = {
      MODE_NUMBER :    1 << 0,
      MODE_ALPHA_NUM : 1 << 1,
      MODE_8BIT_BYTE : 1 << 2,
      MODE_KANJI :     1 << 3
    };
  
    //---------------------------------------------------------------------
    // QRErrorCorrectionLevel
    //---------------------------------------------------------------------
  
    var QRErrorCorrectionLevel = {
      L : 1,
      M : 0,
      Q : 3,
      H : 2
    };
  
    //---------------------------------------------------------------------
    // QRMaskPattern
    //---------------------------------------------------------------------
  
    var QRMaskPattern = {
      PATTERN000 : 0,
      PATTERN001 : 1,
      PATTERN010 : 2,
      PATTERN011 : 3,
      PATTERN100 : 4,
      PATTERN101 : 5,
      PATTERN110 : 6,
      PATTERN111 : 7
    };
  
    //---------------------------------------------------------------------
    // QRUtil
    //---------------------------------------------------------------------
  
    var QRUtil = function() {
  
      var PATTERN_POSITION_TABLE = [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
      ];
      var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
      var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
      var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
  
      var _this = {};
  
      var getBCHDigit = function(data) {
        var digit = 0;
        while (data != 0) {
          digit += 1;
          data >>>= 1;
        }
        return digit;
      };
  
      _this.getBCHTypeInfo = function(data) {
        var d = data << 10;
        while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
          d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
        }
        return ( (data << 10) | d) ^ G15_MASK;
      };
  
      _this.getBCHTypeNumber = function(data) {
        var d = data << 12;
        while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
          d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
        }
        return (data << 12) | d;
      };
  
      _this.getPatternPosition = function(typeNumber) {
        return PATTERN_POSITION_TABLE[typeNumber - 1];
      };
  
      _this.getMaskFunction = function(maskPattern) {
  
        switch (maskPattern) {
  
        case QRMaskPattern.PATTERN000 :
          return function(i, j) { return (i + j) % 2 == 0; };
        case QRMaskPattern.PATTERN001 :
          return function(i, j) { return i % 2 == 0; };
        case QRMaskPattern.PATTERN010 :
          return function(i, j) { return j % 3 == 0; };
        case QRMaskPattern.PATTERN011 :
          return function(i, j) { return (i + j) % 3 == 0; };
        case QRMaskPattern.PATTERN100 :
          return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
        case QRMaskPattern.PATTERN101 :
          return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
        case QRMaskPattern.PATTERN110 :
          return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
        case QRMaskPattern.PATTERN111 :
          return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };
  
        default :
          throw 'bad maskPattern:' + maskPattern;
        }
      };
  
      _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
        var a = qrPolynomial([1], 0);
        for (var i = 0; i < errorCorrectLength; i += 1) {
          a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
        }
        return a;
      };
  
      _this.getLengthInBits = function(mode, type) {
  
        if (1 <= type && type < 10) {
  
          // 1 - 9
  
          switch(mode) {
          case QRMode.MODE_NUMBER    : return 10;
          case QRMode.MODE_ALPHA_NUM : return 9;
          case QRMode.MODE_8BIT_BYTE : return 8;
          case QRMode.MODE_KANJI     : return 8;
          default :
            throw 'mode:' + mode;
          }
  
        } else if (type < 27) {
  
          // 10 - 26
  
          switch(mode) {
          case QRMode.MODE_NUMBER    : return 12;
          case QRMode.MODE_ALPHA_NUM : return 11;
          case QRMode.MODE_8BIT_BYTE : return 16;
          case QRMode.MODE_KANJI     : return 10;
          default :
            throw 'mode:' + mode;
          }
  
        } else if (type < 41) {
  
          // 27 - 40
  
          switch(mode) {
          case QRMode.MODE_NUMBER    : return 14;
          case QRMode.MODE_ALPHA_NUM : return 13;
          case QRMode.MODE_8BIT_BYTE : return 16;
          case QRMode.MODE_KANJI     : return 12;
          default :
            throw 'mode:' + mode;
          }
  
        } else {
          throw 'type:' + type;
        }
      };
  
      _this.getLostPoint = function(qrcode) {
  
        var moduleCount = qrcode.getModuleCount();
  
        var lostPoint = 0;
  
        // LEVEL1
  
        for (var row = 0; row < moduleCount; row += 1) {
          for (var col = 0; col < moduleCount; col += 1) {
  
            var sameCount = 0;
            var dark = qrcode.isDark(row, col);
  
            for (var r = -1; r <= 1; r += 1) {
  
              if (row + r < 0 || moduleCount <= row + r) {
                continue;
              }
  
              for (var c = -1; c <= 1; c += 1) {
  
                if (col + c < 0 || moduleCount <= col + c) {
                  continue;
                }
  
                if (r == 0 && c == 0) {
                  continue;
                }
  
                if (dark == qrcode.isDark(row + r, col + c) ) {
                  sameCount += 1;
                }
              }
            }
  
            if (sameCount > 5) {
              lostPoint += (3 + sameCount - 5);
            }
          }
        };
  
        // LEVEL2
  
        for (var row = 0; row < moduleCount - 1; row += 1) {
          for (var col = 0; col < moduleCount - 1; col += 1) {
            var count = 0;
            if (qrcode.isDark(row, col) ) count += 1;
            if (qrcode.isDark(row + 1, col) ) count += 1;
            if (qrcode.isDark(row, col + 1) ) count += 1;
            if (qrcode.isDark(row + 1, col + 1) ) count += 1;
            if (count == 0 || count == 4) {
              lostPoint += 3;
            }
          }
        }
  
        // LEVEL3
  
        for (var row = 0; row < moduleCount; row += 1) {
          for (var col = 0; col < moduleCount - 6; col += 1) {
            if (qrcode.isDark(row, col)
                && !qrcode.isDark(row, col + 1)
                &&  qrcode.isDark(row, col + 2)
                &&  qrcode.isDark(row, col + 3)
                &&  qrcode.isDark(row, col + 4)
                && !qrcode.isDark(row, col + 5)
                &&  qrcode.isDark(row, col + 6) ) {
              lostPoint += 40;
            }
          }
        }
  
        for (var col = 0; col < moduleCount; col += 1) {
          for (var row = 0; row < moduleCount - 6; row += 1) {
            if (qrcode.isDark(row, col)
                && !qrcode.isDark(row + 1, col)
                &&  qrcode.isDark(row + 2, col)
                &&  qrcode.isDark(row + 3, col)
                &&  qrcode.isDark(row + 4, col)
                && !qrcode.isDark(row + 5, col)
                &&  qrcode.isDark(row + 6, col) ) {
              lostPoint += 40;
            }
          }
        }
  
        // LEVEL4
  
        var darkCount = 0;
  
        for (var col = 0; col < moduleCount; col += 1) {
          for (var row = 0; row < moduleCount; row += 1) {
            if (qrcode.isDark(row, col) ) {
              darkCount += 1;
            }
          }
        }
  
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;
  
        return lostPoint;
      };
  
      return _this;
    }();
  
    //---------------------------------------------------------------------
    // QRMath
    //---------------------------------------------------------------------
  
    var QRMath = function() {
  
      var EXP_TABLE = new Array(256);
      var LOG_TABLE = new Array(256);
  
      // initialize tables
      for (var i = 0; i < 8; i += 1) {
        EXP_TABLE[i] = 1 << i;
      }
      for (var i = 8; i < 256; i += 1) {
        EXP_TABLE[i] = EXP_TABLE[i - 4]
          ^ EXP_TABLE[i - 5]
          ^ EXP_TABLE[i - 6]
          ^ EXP_TABLE[i - 8];
      }
      for (var i = 0; i < 255; i += 1) {
        LOG_TABLE[EXP_TABLE[i] ] = i;
      }
  
      var _this = {};
  
      _this.glog = function(n) {
  
        if (n < 1) {
          throw 'glog(' + n + ')';
        }
  
        return LOG_TABLE[n];
      };
  
      _this.gexp = function(n) {
  
        while (n < 0) {
          n += 255;
        }
  
        while (n >= 256) {
          n -= 255;
        }
  
        return EXP_TABLE[n];
      };
  
      return _this;
    }();
  
    //---------------------------------------------------------------------
    // qrPolynomial
    //---------------------------------------------------------------------
  
    function qrPolynomial(num, shift) {
  
      if (typeof num.length == 'undefined') {
        throw num.length + '/' + shift;
      }
  
      var _num = function() {
        var offset = 0;
        while (offset < num.length && num[offset] == 0) {
          offset += 1;
        }
        var _num = new Array(num.length - offset + shift);
        for (var i = 0; i < num.length - offset; i += 1) {
          _num[i] = num[i + offset];
        }
        return _num;
      }();
  
      var _this = {};
  
      _this.getAt = function(index) {
        return _num[index];
      };
  
      _this.getLength = function() {
        return _num.length;
      };
  
      _this.multiply = function(e) {
  
        var num = new Array(_this.getLength() + e.getLength() - 1);
  
        for (var i = 0; i < _this.getLength(); i += 1) {
          for (var j = 0; j < e.getLength(); j += 1) {
            num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
          }
        }
  
        return qrPolynomial(num, 0);
      };
  
      _this.mod = function(e) {
  
        if (_this.getLength() - e.getLength() < 0) {
          return _this;
        }
  
        var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );
  
        var num = new Array(_this.getLength() );
        for (var i = 0; i < _this.getLength(); i += 1) {
          num[i] = _this.getAt(i);
        }
  
        for (var i = 0; i < e.getLength(); i += 1) {
          num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
        }
  
        // recursive call
        return qrPolynomial(num, 0).mod(e);
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // QRRSBlock
    //---------------------------------------------------------------------
  
    var QRRSBlock = function() {
  
      var RS_BLOCK_TABLE = [
  
        // L
        // M
        // Q
        // H
  
        // 1
        [1, 26, 19],
        [1, 26, 16],
        [1, 26, 13],
        [1, 26, 9],
  
        // 2
        [1, 44, 34],
        [1, 44, 28],
        [1, 44, 22],
        [1, 44, 16],
  
        // 3
        [1, 70, 55],
        [1, 70, 44],
        [2, 35, 17],
        [2, 35, 13],
  
        // 4
        [1, 100, 80],
        [2, 50, 32],
        [2, 50, 24],
        [4, 25, 9],
  
        // 5
        [1, 134, 108],
        [2, 67, 43],
        [2, 33, 15, 2, 34, 16],
        [2, 33, 11, 2, 34, 12],
  
        // 6
        [2, 86, 68],
        [4, 43, 27],
        [4, 43, 19],
        [4, 43, 15],
  
        // 7
        [2, 98, 78],
        [4, 49, 31],
        [2, 32, 14, 4, 33, 15],
        [4, 39, 13, 1, 40, 14],
  
        // 8
        [2, 121, 97],
        [2, 60, 38, 2, 61, 39],
        [4, 40, 18, 2, 41, 19],
        [4, 40, 14, 2, 41, 15],
  
        // 9
        [2, 146, 116],
        [3, 58, 36, 2, 59, 37],
        [4, 36, 16, 4, 37, 17],
        [4, 36, 12, 4, 37, 13],
  
        // 10
        [2, 86, 68, 2, 87, 69],
        [4, 69, 43, 1, 70, 44],
        [6, 43, 19, 2, 44, 20],
        [6, 43, 15, 2, 44, 16],
  
        // 11
        [4, 101, 81],
        [1, 80, 50, 4, 81, 51],
        [4, 50, 22, 4, 51, 23],
        [3, 36, 12, 8, 37, 13],
  
        // 12
        [2, 116, 92, 2, 117, 93],
        [6, 58, 36, 2, 59, 37],
        [4, 46, 20, 6, 47, 21],
        [7, 42, 14, 4, 43, 15],
  
        // 13
        [4, 133, 107],
        [8, 59, 37, 1, 60, 38],
        [8, 44, 20, 4, 45, 21],
        [12, 33, 11, 4, 34, 12],
  
        // 14
        [3, 145, 115, 1, 146, 116],
        [4, 64, 40, 5, 65, 41],
        [11, 36, 16, 5, 37, 17],
        [11, 36, 12, 5, 37, 13],
  
        // 15
        [5, 109, 87, 1, 110, 88],
        [5, 65, 41, 5, 66, 42],
        [5, 54, 24, 7, 55, 25],
        [11, 36, 12, 7, 37, 13],
  
        // 16
        [5, 122, 98, 1, 123, 99],
        [7, 73, 45, 3, 74, 46],
        [15, 43, 19, 2, 44, 20],
        [3, 45, 15, 13, 46, 16],
  
        // 17
        [1, 135, 107, 5, 136, 108],
        [10, 74, 46, 1, 75, 47],
        [1, 50, 22, 15, 51, 23],
        [2, 42, 14, 17, 43, 15],
  
        // 18
        [5, 150, 120, 1, 151, 121],
        [9, 69, 43, 4, 70, 44],
        [17, 50, 22, 1, 51, 23],
        [2, 42, 14, 19, 43, 15],
  
        // 19
        [3, 141, 113, 4, 142, 114],
        [3, 70, 44, 11, 71, 45],
        [17, 47, 21, 4, 48, 22],
        [9, 39, 13, 16, 40, 14],
  
        // 20
        [3, 135, 107, 5, 136, 108],
        [3, 67, 41, 13, 68, 42],
        [15, 54, 24, 5, 55, 25],
        [15, 43, 15, 10, 44, 16],
  
        // 21
        [4, 144, 116, 4, 145, 117],
        [17, 68, 42],
        [17, 50, 22, 6, 51, 23],
        [19, 46, 16, 6, 47, 17],
  
        // 22
        [2, 139, 111, 7, 140, 112],
        [17, 74, 46],
        [7, 54, 24, 16, 55, 25],
        [34, 37, 13],
  
        // 23
        [4, 151, 121, 5, 152, 122],
        [4, 75, 47, 14, 76, 48],
        [11, 54, 24, 14, 55, 25],
        [16, 45, 15, 14, 46, 16],
  
        // 24
        [6, 147, 117, 4, 148, 118],
        [6, 73, 45, 14, 74, 46],
        [11, 54, 24, 16, 55, 25],
        [30, 46, 16, 2, 47, 17],
  
        // 25
        [8, 132, 106, 4, 133, 107],
        [8, 75, 47, 13, 76, 48],
        [7, 54, 24, 22, 55, 25],
        [22, 45, 15, 13, 46, 16],
  
        // 26
        [10, 142, 114, 2, 143, 115],
        [19, 74, 46, 4, 75, 47],
        [28, 50, 22, 6, 51, 23],
        [33, 46, 16, 4, 47, 17],
  
        // 27
        [8, 152, 122, 4, 153, 123],
        [22, 73, 45, 3, 74, 46],
        [8, 53, 23, 26, 54, 24],
        [12, 45, 15, 28, 46, 16],
  
        // 28
        [3, 147, 117, 10, 148, 118],
        [3, 73, 45, 23, 74, 46],
        [4, 54, 24, 31, 55, 25],
        [11, 45, 15, 31, 46, 16],
  
        // 29
        [7, 146, 116, 7, 147, 117],
        [21, 73, 45, 7, 74, 46],
        [1, 53, 23, 37, 54, 24],
        [19, 45, 15, 26, 46, 16],
  
        // 30
        [5, 145, 115, 10, 146, 116],
        [19, 75, 47, 10, 76, 48],
        [15, 54, 24, 25, 55, 25],
        [23, 45, 15, 25, 46, 16],
  
        // 31
        [13, 145, 115, 3, 146, 116],
        [2, 74, 46, 29, 75, 47],
        [42, 54, 24, 1, 55, 25],
        [23, 45, 15, 28, 46, 16],
  
        // 32
        [17, 145, 115],
        [10, 74, 46, 23, 75, 47],
        [10, 54, 24, 35, 55, 25],
        [19, 45, 15, 35, 46, 16],
  
        // 33
        [17, 145, 115, 1, 146, 116],
        [14, 74, 46, 21, 75, 47],
        [29, 54, 24, 19, 55, 25],
        [11, 45, 15, 46, 46, 16],
  
        // 34
        [13, 145, 115, 6, 146, 116],
        [14, 74, 46, 23, 75, 47],
        [44, 54, 24, 7, 55, 25],
        [59, 46, 16, 1, 47, 17],
  
        // 35
        [12, 151, 121, 7, 152, 122],
        [12, 75, 47, 26, 76, 48],
        [39, 54, 24, 14, 55, 25],
        [22, 45, 15, 41, 46, 16],
  
        // 36
        [6, 151, 121, 14, 152, 122],
        [6, 75, 47, 34, 76, 48],
        [46, 54, 24, 10, 55, 25],
        [2, 45, 15, 64, 46, 16],
  
        // 37
        [17, 152, 122, 4, 153, 123],
        [29, 74, 46, 14, 75, 47],
        [49, 54, 24, 10, 55, 25],
        [24, 45, 15, 46, 46, 16],
  
        // 38
        [4, 152, 122, 18, 153, 123],
        [13, 74, 46, 32, 75, 47],
        [48, 54, 24, 14, 55, 25],
        [42, 45, 15, 32, 46, 16],
  
        // 39
        [20, 147, 117, 4, 148, 118],
        [40, 75, 47, 7, 76, 48],
        [43, 54, 24, 22, 55, 25],
        [10, 45, 15, 67, 46, 16],
  
        // 40
        [19, 148, 118, 6, 149, 119],
        [18, 75, 47, 31, 76, 48],
        [34, 54, 24, 34, 55, 25],
        [20, 45, 15, 61, 46, 16]
      ];
  
      var qrRSBlock = function(totalCount, dataCount) {
        var _this = {};
        _this.totalCount = totalCount;
        _this.dataCount = dataCount;
        return _this;
      };
  
      var _this = {};
  
      var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
  
        switch(errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H :
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default :
          return undefined;
        }
      };
  
      _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
  
        var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
  
        if (typeof rsBlock == 'undefined') {
          throw 'bad rs block @ typeNumber:' + typeNumber +
              '/errorCorrectionLevel:' + errorCorrectionLevel;
        }
  
        var length = rsBlock.length / 3;
  
        var list = [];
  
        for (var i = 0; i < length; i += 1) {
  
          var count = rsBlock[i * 3 + 0];
          var totalCount = rsBlock[i * 3 + 1];
          var dataCount = rsBlock[i * 3 + 2];
  
          for (var j = 0; j < count; j += 1) {
            list.push(qrRSBlock(totalCount, dataCount) );
          }
        }
  
        return list;
      };
  
      return _this;
    }();
  
    //---------------------------------------------------------------------
    // qrBitBuffer
    //---------------------------------------------------------------------
  
    var qrBitBuffer = function() {
  
      var _buffer = [];
      var _length = 0;
  
      var _this = {};
  
      _this.getBuffer = function() {
        return _buffer;
      };
  
      _this.getAt = function(index) {
        var bufIndex = Math.floor(index / 8);
        return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
      };
  
      _this.put = function(num, length) {
        for (var i = 0; i < length; i += 1) {
          _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
        }
      };
  
      _this.getLengthInBits = function() {
        return _length;
      };
  
      _this.putBit = function(bit) {
  
        var bufIndex = Math.floor(_length / 8);
        if (_buffer.length <= bufIndex) {
          _buffer.push(0);
        }
  
        if (bit) {
          _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
        }
  
        _length += 1;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrNumber
    //---------------------------------------------------------------------
  
    var qrNumber = function(data) {
  
      var _mode = QRMode.MODE_NUMBER;
      var _data = data;
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return _data.length;
      };
  
      _this.write = function(buffer) {
  
        var data = _data;
  
        var i = 0;
  
        while (i + 2 < data.length) {
          buffer.put(strToNum(data.substring(i, i + 3) ), 10);
          i += 3;
        }
  
        if (i < data.length) {
          if (data.length - i == 1) {
            buffer.put(strToNum(data.substring(i, i + 1) ), 4);
          } else if (data.length - i == 2) {
            buffer.put(strToNum(data.substring(i, i + 2) ), 7);
          }
        }
      };
  
      var strToNum = function(s) {
        var num = 0;
        for (var i = 0; i < s.length; i += 1) {
          num = num * 10 + chatToNum(s.charAt(i) );
        }
        return num;
      };
  
      var chatToNum = function(c) {
        if ('0' <= c && c <= '9') {
          return c.charCodeAt(0) - '0'.charCodeAt(0);
        }
        throw 'illegal char :' + c;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrAlphaNum
    //---------------------------------------------------------------------
  
    var qrAlphaNum = function(data) {
  
      var _mode = QRMode.MODE_ALPHA_NUM;
      var _data = data;
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return _data.length;
      };
  
      _this.write = function(buffer) {
  
        var s = _data;
  
        var i = 0;
  
        while (i + 1 < s.length) {
          buffer.put(
            getCode(s.charAt(i) ) * 45 +
            getCode(s.charAt(i + 1) ), 11);
          i += 2;
        }
  
        if (i < s.length) {
          buffer.put(getCode(s.charAt(i) ), 6);
        }
      };
  
      var getCode = function(c) {
  
        if ('0' <= c && c <= '9') {
          return c.charCodeAt(0) - '0'.charCodeAt(0);
        } else if ('A' <= c && c <= 'Z') {
          return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
        } else {
          switch (c) {
          case ' ' : return 36;
          case '$' : return 37;
          case '%' : return 38;
          case '*' : return 39;
          case '+' : return 40;
          case '-' : return 41;
          case '.' : return 42;
          case '/' : return 43;
          case ':' : return 44;
          default :
            throw 'illegal char :' + c;
          }
        }
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qr8BitByte
    //---------------------------------------------------------------------
  
    var qr8BitByte = function(data) {
  
      var _mode = QRMode.MODE_8BIT_BYTE;
      var _data = data;
      var _bytes = qrcode.stringToBytes(data);
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return _bytes.length;
      };
  
      _this.write = function(buffer) {
        for (var i = 0; i < _bytes.length; i += 1) {
          buffer.put(_bytes[i], 8);
        }
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // qrKanji
    //---------------------------------------------------------------------
  
    var qrKanji = function(data) {
  
      var _mode = QRMode.MODE_KANJI;
      var _data = data;
  
      var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
      if (!stringToBytes) {
        throw 'sjis not supported.';
      }
      !function(c, code) {
        // self test for sjis support.
        var test = stringToBytes(c);
        if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
          throw 'sjis not supported.';
        }
      }('\u53cb', 0x9746);
  
      var _bytes = stringToBytes(data);
  
      var _this = {};
  
      _this.getMode = function() {
        return _mode;
      };
  
      _this.getLength = function(buffer) {
        return ~~(_bytes.length / 2);
      };
  
      _this.write = function(buffer) {
  
        var data = _bytes;
  
        var i = 0;
  
        while (i + 1 < data.length) {
  
          var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);
  
          if (0x8140 <= c && c <= 0x9FFC) {
            c -= 0x8140;
          } else if (0xE040 <= c && c <= 0xEBBF) {
            c -= 0xC140;
          } else {
            throw 'illegal char at ' + (i + 1) + '/' + c;
          }
  
          c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);
  
          buffer.put(c, 13);
  
          i += 2;
        }
  
        if (i < data.length) {
          throw 'illegal char at ' + (i + 1);
        }
      };
  
      return _this;
    };
  
    //=====================================================================
    // GIF Support etc.
    //
  
    //---------------------------------------------------------------------
    // byteArrayOutputStream
    //---------------------------------------------------------------------
  
    var byteArrayOutputStream = function() {
  
      var _bytes = [];
  
      var _this = {};
  
      _this.writeByte = function(b) {
        _bytes.push(b & 0xff);
      };
  
      _this.writeShort = function(i) {
        _this.writeByte(i);
        _this.writeByte(i >>> 8);
      };
  
      _this.writeBytes = function(b, off, len) {
        off = off || 0;
        len = len || b.length;
        for (var i = 0; i < len; i += 1) {
          _this.writeByte(b[i + off]);
        }
      };
  
      _this.writeString = function(s) {
        for (var i = 0; i < s.length; i += 1) {
          _this.writeByte(s.charCodeAt(i) );
        }
      };
  
      _this.toByteArray = function() {
        return _bytes;
      };
  
      _this.toString = function() {
        var s = '';
        s += '[';
        for (var i = 0; i < _bytes.length; i += 1) {
          if (i > 0) {
            s += ',';
          }
          s += _bytes[i];
        }
        s += ']';
        return s;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // base64EncodeOutputStream
    //---------------------------------------------------------------------
  
    var base64EncodeOutputStream = function() {
  
      var _buffer = 0;
      var _buflen = 0;
      var _length = 0;
      var _base64 = '';
  
      var _this = {};
  
      var writeEncoded = function(b) {
        _base64 += String.fromCharCode(encode(b & 0x3f) );
      };
  
      var encode = function(n) {
        if (n < 0) {
          // error.
        } else if (n < 26) {
          return 0x41 + n;
        } else if (n < 52) {
          return 0x61 + (n - 26);
        } else if (n < 62) {
          return 0x30 + (n - 52);
        } else if (n == 62) {
          return 0x2b;
        } else if (n == 63) {
          return 0x2f;
        }
        throw 'n:' + n;
      };
  
      _this.writeByte = function(n) {
  
        _buffer = (_buffer << 8) | (n & 0xff);
        _buflen += 8;
        _length += 1;
  
        while (_buflen >= 6) {
          writeEncoded(_buffer >>> (_buflen - 6) );
          _buflen -= 6;
        }
      };
  
      _this.flush = function() {
  
        if (_buflen > 0) {
          writeEncoded(_buffer << (6 - _buflen) );
          _buffer = 0;
          _buflen = 0;
        }
  
        if (_length % 3 != 0) {
          // padding
          var padlen = 3 - _length % 3;
          for (var i = 0; i < padlen; i += 1) {
            _base64 += '=';
          }
        }
      };
  
      _this.toString = function() {
        return _base64;
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // base64DecodeInputStream
    //---------------------------------------------------------------------
  
    var base64DecodeInputStream = function(str) {
  
      var _str = str;
      var _pos = 0;
      var _buffer = 0;
      var _buflen = 0;
  
      var _this = {};
  
      _this.read = function() {
  
        while (_buflen < 8) {
  
          if (_pos >= _str.length) {
            if (_buflen == 0) {
              return -1;
            }
            throw 'unexpected end of file./' + _buflen;
          }
  
          var c = _str.charAt(_pos);
          _pos += 1;
  
          if (c == '=') {
            _buflen = 0;
            return -1;
          } else if (c.match(/^\s$/) ) {
            // ignore if whitespace.
            continue;
          }
  
          _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
          _buflen += 6;
        }
  
        var n = (_buffer >>> (_buflen - 8) ) & 0xff;
        _buflen -= 8;
        return n;
      };
  
      var decode = function(c) {
        if (0x41 <= c && c <= 0x5a) {
          return c - 0x41;
        } else if (0x61 <= c && c <= 0x7a) {
          return c - 0x61 + 26;
        } else if (0x30 <= c && c <= 0x39) {
          return c - 0x30 + 52;
        } else if (c == 0x2b) {
          return 62;
        } else if (c == 0x2f) {
          return 63;
        } else {
          throw 'c:' + c;
        }
      };
  
      return _this;
    };
  
    //---------------------------------------------------------------------
    // gifImage (B/W)
    //---------------------------------------------------------------------
  
    var gifImage = function(width, height) {
  
      var _width = width;
      var _height = height;
      var _data = new Array(width * height);
  
      var _this = {};
  
      _this.setPixel = function(x, y, pixel) {
        _data[y * _width + x] = pixel;
      };
  
      _this.write = function(out) {
  
        //---------------------------------
        // GIF Signature
  
        out.writeString('GIF87a');
  
        //---------------------------------
        // Screen Descriptor
  
        out.writeShort(_width);
        out.writeShort(_height);
  
        out.writeByte(0x80); // 2bit
        out.writeByte(0);
        out.writeByte(0);
  
        //---------------------------------
        // Global Color Map
  
        // black
        out.writeByte(0x00);
        out.writeByte(0x00);
        out.writeByte(0x00);
  
        // white
        out.writeByte(0xff);
        out.writeByte(0xff);
        out.writeByte(0xff);
  
        //---------------------------------
        // Image Descriptor
  
        out.writeString(',');
        out.writeShort(0);
        out.writeShort(0);
        out.writeShort(_width);
        out.writeShort(_height);
        out.writeByte(0);
  
        //---------------------------------
        // Local Color Map
  
        //---------------------------------
        // Raster Data
  
        var lzwMinCodeSize = 2;
        var raster = getLZWRaster(lzwMinCodeSize);
  
        out.writeByte(lzwMinCodeSize);
  
        var offset = 0;
  
        while (raster.length - offset > 255) {
          out.writeByte(255);
          out.writeBytes(raster, offset, 255);
          offset += 255;
        }
  
        out.writeByte(raster.length - offset);
        out.writeBytes(raster, offset, raster.length - offset);
        out.writeByte(0x00);
  
        //---------------------------------
        // GIF Terminator
        out.writeString(';');
      };
  
      var bitOutputStream = function(out) {
  
        var _out = out;
        var _bitLength = 0;
        var _bitBuffer = 0;
  
        var _this = {};
  
        _this.write = function(data, length) {
  
          if ( (data >>> length) != 0) {
            throw 'length over';
          }
  
          while (_bitLength + length >= 8) {
            _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
            length -= (8 - _bitLength);
            data >>>= (8 - _bitLength);
            _bitBuffer = 0;
            _bitLength = 0;
          }
  
          _bitBuffer = (data << _bitLength) | _bitBuffer;
          _bitLength = _bitLength + length;
        };
  
        _this.flush = function() {
          if (_bitLength > 0) {
            _out.writeByte(_bitBuffer);
          }
        };
  
        return _this;
      };
  
      var getLZWRaster = function(lzwMinCodeSize) {
  
        var clearCode = 1 << lzwMinCodeSize;
        var endCode = (1 << lzwMinCodeSize) + 1;
        var bitLength = lzwMinCodeSize + 1;
  
        // Setup LZWTable
        var table = lzwTable();
  
        for (var i = 0; i < clearCode; i += 1) {
          table.add(String.fromCharCode(i) );
        }
        table.add(String.fromCharCode(clearCode) );
        table.add(String.fromCharCode(endCode) );
  
        var byteOut = byteArrayOutputStream();
        var bitOut = bitOutputStream(byteOut);
  
        // clear code
        bitOut.write(clearCode, bitLength);
  
        var dataIndex = 0;
  
        var s = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
  
        while (dataIndex < _data.length) {
  
          var c = String.fromCharCode(_data[dataIndex]);
          dataIndex += 1;
  
          if (table.contains(s + c) ) {
  
            s = s + c;
  
          } else {
  
            bitOut.write(table.indexOf(s), bitLength);
  
            if (table.size() < 0xfff) {
  
              if (table.size() == (1 << bitLength) ) {
                bitLength += 1;
              }
  
              table.add(s + c);
            }
  
            s = c;
          }
        }
  
        bitOut.write(table.indexOf(s), bitLength);
  
        // end code
        bitOut.write(endCode, bitLength);
  
        bitOut.flush();
  
        return byteOut.toByteArray();
      };
  
      var lzwTable = function() {
  
        var _map = {};
        var _size = 0;
  
        var _this = {};
  
        _this.add = function(key) {
          if (_this.contains(key) ) {
            throw 'dup key:' + key;
          }
          _map[key] = _size;
          _size += 1;
        };
  
        _this.size = function() {
          return _size;
        };
  
        _this.indexOf = function(key) {
          return _map[key];
        };
  
        _this.contains = function(key) {
          return typeof _map[key] != 'undefined';
        };
  
        return _this;
      };
  
      return _this;
    };
  
    var createDataURL = function(width, height, getPixel) {
      var gif = gifImage(width, height);
      for (var y = 0; y < height; y += 1) {
        for (var x = 0; x < width; x += 1) {
          gif.setPixel(x, y, getPixel(x, y) );
        }
      }
  
      var b = byteArrayOutputStream();
      gif.write(b);
  
      var base64 = base64EncodeOutputStream();
      var bytes = b.toByteArray();
      for (var i = 0; i < bytes.length; i += 1) {
        base64.writeByte(bytes[i]);
      }
      base64.flush();
  
      return 'data:image/gif;base64,' + base64;
    };
  
    //---------------------------------------------------------------------
    // returns qrcode function.
  
    return qrcode;
  }();
  
  // multibyte support
  !function() {
  
    qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
      // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
      function toUTF8Array(str) {
        var utf8 = [];
        for (var i=0; i < str.length; i++) {
          var charcode = str.charCodeAt(i);
          if (charcode < 0x80) utf8.push(charcode);
          else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
          }
          else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode>>6) & 0x3f),
                0x80 | (charcode & 0x3f));
          }
          // surrogate pair
          else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
              | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18),
                0x80 | ((charcode>>12) & 0x3f),
                0x80 | ((charcode>>6) & 0x3f),
                0x80 | (charcode & 0x3f));
          }
        }
        return utf8;
      }
      return toUTF8Array(s);
    };
  
  }();
  qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
  return qrcode;
  })();

  /* ---------- QR → SVG (verbatim: Doner প্যানেল) ---------- */
  export function qrSVG(txt,size=72,opt={}){
    const ecl=opt.ecl||"M", dark=opt.dark||"#0b1f19", light=opt.light||"#ffffff", quiet=opt.quiet??2;
    let q=null;
    for(const lv of [ecl,"L"]){ try{ const t=QRLIB(0,lv); t.addData(txt,"Byte"); t.make(); q=t; break; }catch(e){} }
    if(!q)return `<svg width="${size}" height="${size}"></svg>`;
    const n=q.getModuleCount(), t=n+quiet*2; let d="";
    for(let r=0;r<n;r++){ let c=0;
      while(c<n){ if(q.isDark(r,c)){ let w=1; while(c+w<n&&q.isDark(r,c+w))w++; d+=`M${c+quiet} ${r+quiet}h${w}v1h-${w}z`; c+=w; } else c++; } }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" width="${size}" height="${size}" shape-rendering="crispEdges">`
      +`<rect width="${t}" height="${t}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
  }

  /* ---------- ছোট helpers (verbatim: Doner প্যানেল) ---------- */
  const D9=["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  const bnDigits=v=>String(v??"").replace(/\d/g,d=>D9[d]);
  const dayDiff=a=>Math.floor((new Date().setHours(0,0,0,0)-new Date(a+"T00:00:00").setHours(0,0,0,0))/864e5);

  /* ডিফল্ট অবতার — ছবি না থাকলে (verbatim: Doner প্যানেলের AV) */
  export const AV=(g,p)=>p||("data:image/svg+xml;utf8,"+encodeURIComponent(g==="মহিলা"
   ?`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#ffe4ef"/><path d="M18 25c0-9 7-13 22-13s22 4 22 13v8c0 9-7 13-22 13S18 42 18 33z" fill="#d76a9a"/><circle cx="40" cy="53" r="14" fill="#e8a8c2"/><path d="M22 70c0-11 8-17 18-17s18 6 18 17z" fill="#d76a9a"/></svg>`
   :`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#dcedfb"/><circle cx="40" cy="29" r="17" fill="#4a90d9"/><path d="M20 69c0-14 9-22 20-22s20 8 20 22z" fill="#4a90d9"/></svg>`));

  /* ক্লাবের তথ্য — SITE কনফিগ থেকে (Doner প্যানেলের CLUB-এর হুবহু গঠন) */
  export const CARD_CLUB={name:SITE.name,en:SITE.nameEn,
    phone:SITE.phone,site:SITE.website,addr:SITE.address};

  /* কার্ডের স্ট্যাটাস — Doner প্যানেলের cardStat()-এর হুবহু নিয়ম।
     tp(bn,en) অনুবাদক ঐচ্ছিক (Doner প্যানেল নিজের i18n tp পাঠায়)। */
  export function cardStatFor(sub,tp){
    const t2=tp||((b)=>b);
    const rest=sub.lastDonation?Math.max(0,90-dayDiff(sub.lastDonation)):0;
    return rest>0?{t:t2("বিশ্রামে · "+bnDigits(rest)+" দিন","Resting · "+rest+" days"),c:"rest"}
      :sub.available!==false?{t:"রক্তদানে প্রস্তুত",c:""}:{t:"আপাতত বন্ধ",c:"off"};
  }

  /* subject-এ ডিফল্ট বসানো — stat/club/logo না দিলে এখান থেকে আসে */
  export function withCardDefaults(subject){
    const s=Object.assign({},subject||{});
    s.club=s.club||CARD_CLUB;
    s.logo=s.logo||logoUrl();
    s.cardTheme=s.cardTheme||"green";
    s.stat=s.stat||cardStatFor(s);
    return s;
  }

  /* vCard payload — scanning saves the donor as a phone contact.
     Kept compact on purpose: Bangla is 3 bytes/char in UTF-8, and a smaller
     payload means fewer QR modules, which is what makes the printed
     22mm card QR reliably scannable by a phone camera.
     (verbatim নিয়ম — এখন কার্ডের subject-এর তথ্য থেকেই তৈরি হয়) */
  export function vcardTextOf(sub){
    const ec=v=>String(v??"").replace(/([,;\\])/g,"\\$1").replace(/\n/g,"\\n");
    const ph=String(sub.phone||"").replace(/\D/g,""), intl=ph.length===11?"+88"+ph:ph;
    const rest=sub.lastDonation?Math.max(0,90-dayDiff(sub.lastDonation)):0;
    const L=["BEGIN:VCARD","VERSION:3.0",
      "FN:"+ec(sub.name),
      "ORG:CBDC",
      "TITLE:"+ec(sub.bloodGroup+" রক্তদাতা")];
    if(intl)L.push("TEL;CELL:"+intl);
    L.push("NOTE:"+ec(sub.donorId+" · "+sub.area+" · "+(rest>0?"বিশ্রামে":sub.available!==false?"প্রস্তুত":"বন্ধ")));
    L.push("END:VCARD");
    return L.join("\r\n");
  }

  /* ══════════ CARD → PNG (verbatim: Doner প্যানেলের drawFront/drawBack/drawTall) ══════════ */
  const CF='"SolaimanLipi","Noto Sans Bengali","Hind Siliguri","Nirmala UI",sans-serif';
  function themeCols(t){return{green:["#0d7a52","#075c3c","#03301f"],red:["#c62630","#8d1017","#4d060b"],
    dark:["#2b3a35","#18241f","#0a110e"]}[t||"green"]}
  const rr=(x,r0,y,w,h,rad)=>{x.beginPath();x.moveTo(r0+rad,y);x.arcTo(r0+w,y,r0+w,y+h,rad);
    x.arcTo(r0+w,y+h,r0,y+h,rad);x.arcTo(r0,y+h,r0,y,rad);x.arcTo(r0,y,r0+w,y,rad);x.closePath()};
  function svgImg(sv){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);
    i.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(sv)})}
  async function loadImg(src){return new Promise(r=>{const i=new Image();i.crossOrigin="anonymous";
    i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src})}
  function fitText(x,txt,max,start,min,weight){let s=start;
    do{x.font=`${weight} ${s}px `+CF;if(x.measureText(txt).width<=max)break;s-=1}while(s>min);return s}
  function wrapLines(x,txt,max){
    const w=txt.split(" "),out=[];let cur="";
    for(const word of w){const t=cur?cur+" "+word:word;
      if(x.measureText(t).width>max&&cur){out.push(cur);cur=word}else cur=t}
    if(cur)out.push(cur);return out;
  }

  /* 86×54mm @ ~300dpi → 1016×638. All positions derive from W so the
     layout stays correct at any output size. */
  export async function drawCardFront(x,W,H,S,subject){
    const sub=withCardDefaults(subject),st=sub.stat,c=themeCols(sub.cardTheme),CLUB=sub.club;
    const pad=W*.033;
    const g=x.createLinearGradient(0,0,W,H);
    g.addColorStop(0,c[0]);g.addColorStop(.46,c[1]);g.addColorStop(1,c[2]);
    x.fillStyle=g;x.fillRect(0,0,W,H);
    const rg=x.createRadialGradient(W*.88,-H*.14,0,W*.88,-H*.14,W*.55);
    rg.addColorStop(0,"rgba(255,255,255,.19)");rg.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=rg;x.fillRect(0,0,W,H);
    x.save();x.beginPath();x.rect(0,0,W,H);x.clip();
    x.strokeStyle="rgba(255,255,255,.05)";x.lineWidth=W*.026;
    x.beginPath();x.arc(W*1.05,H*1.16,W*.21,0,7);x.stroke();x.restore();

    /* ── header ── */
    const hH=H*.145, hcy=hH/2;
    const lgR=W*.0165;
    x.fillStyle="#fff";x.beginPath();x.arc(pad+lgR,hcy,lgR,0,7);x.fill();
    const lg=await svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60" height="60"><path d="M12 3.4s6.2 6.1 6.2 10.1a6.2 6.2 0 1 1-12.4 0C5.8 9.5 12 3.4 12 3.4z" fill="#c8101d"/></svg>`);
    if(lg)x.drawImage(lg,pad+lgR*.42,hcy-lgR*.62,lgR*1.16,lgR*1.16);
    /* verified pill (right) */
    const vt="যাচাইকৃত";
    x.font=`800 ${W*.0165}px `+CF;
    const vw=x.measureText(vt).width+W*.052, vh=H*.052, vx=W-pad-vw, vy=hcy-vh/2;
    x.fillStyle="rgba(255,255,255,.15)";rr(x,vx,vy,vw,vh,vh/2);x.fill();
    const cr=W*.0088, ccx=vx+W*.019;
    x.fillStyle="#fff";x.beginPath();x.arc(ccx,hcy,cr,0,7);x.fill();
    x.strokeStyle=c[1];x.lineWidth=W*.0026;x.lineCap="round";x.lineJoin="round";
    x.beginPath();x.moveTo(ccx-cr*.45,hcy);x.lineTo(ccx-cr*.05,hcy+cr*.42);x.lineTo(ccx+cr*.5,hcy-cr*.38);x.stroke();
    x.textAlign="left";x.textBaseline="middle";x.fillStyle="#fff";x.fillText(vt,ccx+cr+W*.007,hcy+W*.001);
    /* club name (fills space between logo and pill) */
    const nx=pad+lgR*2+W*.011, navail=vx-nx-W*.012;
    x.fillStyle="#fff";
    const cs=fitText(x,CLUB.name,navail,W*.0285,W*.019,"800");
    x.fillText(CLUB.name,nx,hcy-cs*.36);
    x.fillStyle="rgba(255,255,255,.68)";x.font=`700 ${W*.0155}px `+CF;
    x.fillText("DONOR IDENTITY CARD",nx,hcy+cs*.62);
    x.textBaseline="alphabetic";
    x.strokeStyle="rgba(255,255,255,.16)";x.lineWidth=Math.max(1,W*.001);
    x.beginPath();x.moveTo(0,hH);x.lineTo(W,hH);x.stroke();

    /* ── footer band (reserve first) ── */
    const fH=H*.108, fY=H-fH;

    /* ── QR column (right), vertically inside body ── */
    const bodyBot=fY-H*.028;
    const capH=H*.058;
    const qs=Math.min(bodyBot-hH-H*.045-capH, W*.255);
    const qx=W-pad-qs, qy=hH+(bodyBot-hH-qs-capH)/2;
    x.fillStyle="#fff";rr(x,qx,qy,qs,qs,W*.012);x.fill();
    const qp=qs*.072;
    const qi=await svgImg(qrSVG(vcardTextOf(sub),Math.round(qs-qp*2),{ecl:"L",quiet:0}));
    if(qi)x.drawImage(qi,qx+qp,qy+qp,qs-qp*2,qs-qp*2);
    x.textAlign="center";x.fillStyle="rgba(255,255,255,.7)";x.font=`700 ${H*.028}px `+CF;
    x.fillText("স্ক্যান করুন",qx+qs/2,qy+qs+capH*.68);

    /* ── photo + blood chip (left) ── */
    const ps=H*.375, chH=H*.105, chGap=H*.026;
    const leftH=ps+chGap+chH;
    const px=pad, py=hH+(bodyBot-hH-leftH)/2;
    const im=await loadImg(AV(sub.gender,sub.photo));
    x.save();rr(x,px,py,ps,ps,W*.016);x.clip();
    if(im)x.drawImage(im,px,py,ps,ps);
    else{x.fillStyle="rgba(255,255,255,.2)";x.fillRect(px,py,ps,ps)}x.restore();
    x.strokeStyle="rgba(255,255,255,.85)";x.lineWidth=W*.0038;rr(x,px,py,ps,ps,W*.016);x.stroke();
    const chY=py+ps+chGap;
    x.fillStyle="#fff";rr(x,px,chY,ps,chH,W*.01);x.fill();
    x.fillStyle=(sub.cardTheme==="red")?"#8d1017":"#c8101d";
    x.textAlign="center";x.font=`800 ${H*.072}px `+CF;
    x.fillText(sub.bloodGroup,px+ps/2,chY+chH*.74);

    /* ── centre column (vertically centred) ── */
    const tx=px+ps+W*.028, tw=qx-tx-W*.026;
    x.textAlign="left";
    const ns=fitText(x,sub.name,tw,H*.095,H*.052,"800");
    const roleGap=H*.055, blockGap=H*.068, rowH=H*.075;
    const midH=ns*.78+roleGap+blockGap+rowH*3;
    let ty=hH+(bodyBot-hH-midH)/2+ns*.78;
    x.fillStyle="#fff";x.font=`800 ${ns}px `+CF;
    x.fillText(sub.name,tx,ty);
    ty+=roleGap;
    x.fillStyle="rgba(255,255,255,.72)";x.font=`700 ${H*.032}px `+CF;
    x.fillText("স্বেচ্ছায় রক্তদাতা",tx,ty);
    ty+=blockGap;
    const kw=W*.088;
    [["এলাকা",sub.area],["মোবাইল",sub.phone],
     ...(sub.ageText||sub.gender?[["বয়স",(sub.ageText||"")+(sub.ageText&&sub.gender?" · ":"")+(sub.gender||"")]]:[])
    ].filter(([,v])=>v).forEach(([k,v])=>{
      x.font=`600 ${H*.031}px `+CF;x.fillStyle="rgba(255,255,255,.6)";x.fillText(k,tx,ty);
      x.fillStyle="#fff";
      let fs=H*.034;x.font=`800 ${fs}px `+CF;
      while(x.measureText(String(v)).width>tw-kw&&fs>H*.022){fs-=H*.0012;x.font=`800 ${fs}px `+CF}
      x.fillText(String(v),tx+kw,ty);
      x.strokeStyle="rgba(255,255,255,.1)";x.lineWidth=Math.max(1,W*.001);
      x.beginPath();x.moveTo(tx,ty+rowH*.28);x.lineTo(tx+tw,ty+rowH*.28);x.stroke();
      ty+=rowH});

    /* ── footer ── */
    x.fillStyle="rgba(0,0,0,.26)";x.fillRect(0,fY,W,fH);
    x.textBaseline="middle";
    x.textAlign="left";x.fillStyle="#fff";x.font=`800 ${W*.0205}px ui-monospace,Menlo,monospace`;
    x.fillText(sub.donorId,pad,fY+fH/2);
    x.textAlign="right";x.font=`700 ${W*.0175}px `+CF;
    x.fillStyle="rgba(255,255,255,.9)";x.fillText(st.t,W-pad,fY+fH/2);
    const sw=x.measureText(st.t).width;
    x.fillStyle=st.c==="rest"?"#fbbf24":st.c==="off"?"#94a3b8":"#4ade80";
    x.beginPath();x.arc(W-pad-sw-W*.014,fY+fH/2,W*.0058,0,7);x.fill();
    x.textBaseline="alphabetic";
  }
  export async function drawCardBack(x,W,H,S,subject){
    const sub=withCardDefaults(subject),CLUB=sub.club;
    const dk=sub.cardTheme==="red"?"#8d1017":sub.cardTheme==="dark"?"#18241f":"#075c3c";
    const g=x.createLinearGradient(0,0,W,H);
    if(sub.cardTheme==="red"){g.addColorStop(0,"#fdf6f6");g.addColorStop(1,"#f6e6e7")}
    else if(sub.cardTheme==="dark"){g.addColorStop(0,"#eef1f0");g.addColorStop(1,"#dee4e2")}
    else{g.addColorStop(0,"#f7faf9");g.addColorStop(1,"#e8f2ee")}
    x.fillStyle=g;x.fillRect(0,0,W,H);
    const ink=sub.cardTheme==="red"?"#4a1013":"#123024";
    const pad=34*S, bh=38*S, ftH=26*S;
    x.fillStyle=dk;x.fillRect(0,0,W,bh);
    x.textAlign="center";x.fillStyle="#fff";x.font=`800 ${13*S}px `+CF;
    x.fillText("রক্ত দিন · জীবন বাঁচান",W/2,bh/2+5*S);
    /* QR block sized to fit between header and footer */
    const capH=26*S, avail=H-bh-ftH-16*S-capH;
    const qs=Math.min(avail,168*S), qx=W-pad-qs, qy=bh+(H-bh-ftH-qs-capH)/2;
    x.fillStyle="#fff";x.shadowColor="rgba(6,60,40,.18)";x.shadowBlur=13*S;x.shadowOffsetY=3*S;
    rr(x,qx,qy,qs,qs,11*S);x.fill();x.shadowColor="transparent";x.shadowBlur=0;x.shadowOffsetY=0;
    const qpad=9*S;
    const qi=await svgImg(qrSVG(vcardTextOf(sub),Math.round(qs-qpad*2),{ecl:"L",quiet:0}));
    if(qi)x.drawImage(qi,qx+qpad,qy+qpad,qs-qpad*2,qs-qpad*2);
    x.fillStyle=ink;x.globalAlpha=.62;x.font=`800 ${9.5*S}px `+CF;
    x.fillText("স্ক্যান করলে সব তথ্য পাবেন",qx+qs/2,qy+qs+15*S);x.globalAlpha=1;
    /* left column */
    const lx=pad, lw=qx-lx-20*S;
    let y=bh+30*S;
    x.textAlign="left";
    x.fillStyle=ink;x.globalAlpha=.55;x.font=`800 ${9.5*S}px `+CF;x.fillText("ক্লাবের যোগাযোগ",lx,y);x.globalAlpha=1;
    y+=19*S;
    const kw=44*S;
    [["হটলাইন",CLUB.phone],["ঠিকানা",CLUB.addr],["ওয়েব",CLUB.site]].forEach(([k,v])=>{
      x.fillStyle=ink;x.globalAlpha=.6;x.font=`600 ${10.5*S}px `+CF;x.fillText(k,lx,y);x.globalAlpha=1;
      x.font=`800 ${11*S}px `+CF;
      let fs=11*S;while(x.measureText(v).width>lw-kw&&fs>7*S){fs-=.5;x.font=`800 ${fs}px `+CF}
      x.fillText(v,lx+kw,y);y+=17.5*S});
    y+=8*S;
    x.fillStyle=ink;x.globalAlpha=.55;x.font=`800 ${9.5*S}px `+CF;x.fillText("কার্ডটি পেলে",lx,y);x.globalAlpha=1;
    y+=16*S;x.font=`600 ${10*S}px `+CF;x.fillStyle=ink;
    wrapLines(x,"QR স্ক্যান করে কার্ডধারীর সাথে যোগাযোগ করুন অথবা উপরের হটলাইনে জানান।",lw)
      .forEach(t=>{x.fillText(t,lx,y);y+=14*S});
    /* footer */
    x.textAlign="center";x.globalAlpha=.5;x.font=`700 ${9*S}px `+CF;x.fillStyle=ink;
    x.fillText("এই কার্ড "+CLUB.name+"-এর সম্পত্তি · হস্তান্তরযোগ্য নয়",W/2,H-9*S);x.globalAlpha=1;
  }
  /* 900×1600 share card */
  export async function drawCardTall(x,W,H,S,subject){
    const sub=withCardDefaults(subject),st=sub.stat,c=themeCols(sub.cardTheme),CLUB=sub.club;
    const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,c[0]);g.addColorStop(.5,c[1]);g.addColorStop(1,c[2]);
    x.fillStyle=g;x.fillRect(0,0,W,H);
    const rg=x.createRadialGradient(W*.9,H*.05,0,W*.9,H*.05,W*.9);
    rg.addColorStop(0,"rgba(255,255,255,.16)");rg.addColorStop(1,"rgba(255,255,255,0)");
    x.fillStyle=rg;x.fillRect(0,0,W,H);
    const pad=W*.055;
    /* bottom-anchored QR block */
    const qs=W*.30, capGap=W*.042, qy=H-pad*1.1-capGap-qs;
    x.fillStyle="#fff";rr(x,W/2-qs/2,qy,qs,qs,W*.014);x.fill();
    const qp=qs*.075;
    const qi=await svgImg(qrSVG(vcardTextOf(sub),Math.round(qs-qp*2),{ecl:"L",quiet:0}));
    if(qi)x.drawImage(qi,W/2-qs/2+qp,qy+qp,qs-qp*2,qs-qp*2);
    x.textAlign="center";x.fillStyle="rgba(255,255,255,.75)";x.font=`700 ${W*.0285}px `+CF;
    x.fillText("স্ক্যান করে কন্টাক্টে যোগ করুন",W/2,qy+qs+capGap*.85);
    /* header */
    const tl=await loadImg(sub.logo), tlR=W*.082, tly=H*.052;
    if(tl){x.save();x.beginPath();x.arc(W/2,tly,tlR,0,7);x.fillStyle="#fff";x.fill();x.clip();
      x.drawImage(tl,W/2-tlR,tly-tlR,tlR*2,tlR*2);x.restore();}
    x.fillStyle="#fff";fitText(x,CLUB.name,W-pad*3,W*.055,W*.036,"800");
    x.fillText(CLUB.name,W/2,tly+tlR+W*.055);
    x.fillStyle="rgba(255,255,255,.66)";x.font=`700 ${W*.031}px `+CF;
    x.fillText("ডিজিটাল ডোনার কার্ড",W/2,tly+tlR+W*.095);
    /* photo */
    const pr=W*.152,pcy=H*.245;
    const im=await loadImg(AV(sub.gender,sub.photo));
    x.save();x.beginPath();x.arc(W/2,pcy,pr,0,7);x.clip();
    if(im)x.drawImage(im,W/2-pr,pcy-pr,pr*2,pr*2);
    else{x.fillStyle="rgba(255,255,255,.2)";x.fillRect(W/2-pr,pcy-pr,pr*2,pr*2)}x.restore();
    x.strokeStyle="rgba(255,255,255,.88)";x.lineWidth=W*.0095;x.beginPath();x.arc(W/2,pcy,pr,0,7);x.stroke();
    /* name */
    x.fillStyle="#fff";const ns=fitText(x,sub.name,W-pad*2.4,W*.068,W*.04,"800");
    x.fillText(sub.name,W/2,pcy+pr+ns*.95);
    x.fillStyle="rgba(255,255,255,.7)";x.font=`700 ${W*.031}px `+CF;
    x.fillText("স্বেচ্ছায় রক্তদাতা",W/2,pcy+pr+ns*.95+W*.045);
    /* blood */
    const br=W*.093,bcy=pcy+pr+ns*.95+W*.045+br+W*.05;
    x.fillStyle="#fff";x.beginPath();x.arc(W/2,bcy,br,0,7);x.fill();
    x.fillStyle=(sub.cardTheme==="red")?"#8d1017":"#c8101d";x.font=`800 ${W*.075}px `+CF;
    x.fillText(sub.bloodGroup,W/2,bcy+W*.027);
    /* info rows spread between blood circle and QR */
    const rows=[["আইডি",sub.donorId],["এলাকা",sub.area],["মোবাইল",sub.phone],["অবস্থা",st.t]];
    const top=bcy+br+W*.055, bot=qy-W*.045, step=Math.min((bot-top)/rows.length,W*.082);
    let y=top+step*.62;
    rows.forEach(([k,v])=>{
      x.textAlign="left";x.fillStyle="rgba(255,255,255,.6)";x.font=`600 ${W*.0335}px `+CF;x.fillText(k,pad,y);
      x.textAlign="right";x.fillStyle="#fff";x.font=`800 ${W*.035}px `+CF;x.fillText(String(v),W-pad,y);
      x.strokeStyle="rgba(255,255,255,.15)";x.lineWidth=1.5;x.beginPath();
      x.moveTo(pad,y+step*.28);x.lineTo(W-pad,y+step*.28);x.stroke();
      y+=step});
  }

  /* ---------- ফাইলনাম + ব্রাউজার ডাউনলোড (verbatim: Doner প্যানেল) ---------- */
  /* Browsers silently drop a download filename that is not ASCII-safe, so a
     Bangla name used to arrive as "download". Transliterate the donor id /
     name into a safe slug and keep the readable part in the card itself. */
  export function safeCardFileName(name,fallback="donor"){
    const ascii=String(name||"").replace(/[^\x20-\x7E]/g,"").replace(/\s+/g,"-")
      .replace(/-+/g,"-").replace(/^-|-$/g,"");
    return ascii.length>=2?ascii:fallback;
  }
  export function dlBlob(blob,name){
    /* the anchor must be in the document for the download attribute to be
       honoured — a detached <a> loses the filename in several browsers */
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=name||"download";
    a.style.display="none";
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
  }

  /* ══════════ ডাউনলোড flow (verbatim: Doner প্যানেলের dlCard) ══════════
     kind: "both" | "front" | "back" | "tall"
     hooks.toast(msg, kind) — kind: "" | "ok" | "er" (পেজ নিজের toast-এ ম্যাপ করে)
     সফল হলে true ফেরত দেয় (ব্যস্ত/ব্যর্থ হলে false)। */
  let cardBusy=false;
  export async function downloadDonorCardImages(kind,subject,hooks={}){
    const toast=hooks.toast||(()=>{});
    if(cardBusy)return false;cardBusy=true;
    let done=false;
    try{
      await (document.fonts?document.fonts.ready:Promise.resolve());
      toast("কার্ড তৈরি হচ্ছে…");
      const sub=withCardDefaults(subject);
      const specs={front:[1016,638,drawCardFront,"সামনে"],back:[1016,638,drawCardBack,"পেছনে"],tall:[900,1600,drawCardTall,"শেয়ার"]};
      const list = kind==="both" ? ["front","back"] : [kind||"front"];
      for(const k of list){
        const [W,H,fn,lb]=specs[k],S=W/(k==="tall"?360:406);
        const c=document.createElement("canvas");c.width=W;c.height=H;
        const x=c.getContext("2d");x.textBaseline="alphabetic";
        await fn(x,W,H,S,sub);
        const base=safeCardFileName(sub.donorId)!=="donor"?safeCardFileName(sub.donorId):safeCardFileName(sub.name,"CBDC-donor");
        const side={"সামনে":"front","পেছনে":"back","শেয়ার":"share"}[lb]||"card";
        await new Promise(r=>c.toBlob(b=>{dlBlob(b,`${base}-${side}.png`);r()},"image/png"));
        if(list.length>1)await new Promise(r=>setTimeout(r,450));
      }
      toast(list.length>1?"দুই পাশই নামানো হয়েছে":"কার্ড নামানো হয়েছে","ok");
      done=true;
    }catch(e){console.error(e);toast("ডাউনলোড ব্যর্থ হয়েছে","er")}
    finally{setTimeout(()=>cardBusy=false,600)}
    return done;
  }

  /* ══════════ "কার্ড নামান" sheet ══════════ */
  /* আইকন — Doner প্যানেলের ICON.info/down/x-এর হুবহু SVG */
  const SHEET_I=(p,sz=22)=>`<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const SHEET_ICON={
    info:s=>SHEET_I(`<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>`,s),
    down:s=>SHEET_I(`<path d="M12 3.5v12"/><path d="M7.5 11.5 12 16l4.5-4.5"/><path d="M4 20.5h16"/>`,s),
    x:s=>SHEET_I(`<path d="M18 6 6 18M6 6l12 12"/>`,s)
  };

  /* sheet-এর ভেতরের ৩টি অপশন + নোট — একক মার্কআপ (Doner প্যানেলের sheetDownload-এর body)।
     Doner প্যানেল নিজের sheet()-এ এই body বসায়; মেইন ওয়েবসাইট নিচের
     openDonorCardDownloadSheet() ব্যবহার করে — মার্কআপ এক জায়গাতেই থাকে। */
  export function donorCardSheetBodyHTML(infoIcon){
    return `<div class="opt on" data-k="both"><i></i><div><b>ছাপানোর কার্ড — দুই পাশ</b>
         <small>৮৬×৫৪ মিমি, ATM কার্ডের মাপ · ১০১৬×৬৩৮ px</small>
         <small class="mut">সামনে ও পেছনে — দুটি ছবি নামবে</small></div></div>
       <div class="opt" data-k="front"><i></i><div><b>শুধু সামনের পাশ</b>
         <small>৮৬×৫৪ মিমি · ১টি ছবি</small></div></div>
       <div class="opt" data-k="tall"><i></i><div><b>শেয়ার কার্ড — লম্বা</b>
         <small>ফেসবুক ও WhatsApp-এ শেয়ারের জন্য · ৯০০×১৬০০ px</small></div></div>
       <div class="note i" style="margin-top:11px">${infoIcon||SHEET_ICON.info(16)}<span>যেকোনো কার্ডের QR স্ক্যান করলে নাম, মোবাইল, রক্তের গ্রুপ, এলাকা ও আইডি দেখা যাবে এবং ফোনে কন্টাক্ট হিসেবে সেভ করা যাবে।</span></div>`;
  }

  /* মেইন ওয়েবসাইটের জন্য sheet-এর scoped CSS — Doner প্যানেলের .ov/.sheet/.opt/.note/.btn
     রুলের হুবহু কপি, শুধু .cdk- prefix-এ scope করা যাতে সাইটের নিজস্ব ক্লাসের সাথে
     কোনো সংঘর্ষ না হয় (z-index সাইটের modal(100)-এর উপরে)। */
  const SHEET_CSS=`
.cdk-ov{position:fixed;inset:0;z-index:140;background:rgba(8,20,16,.5);animation:cdkfade .16s;backdrop-filter:blur(2px)}
@keyframes cdkfade{from{opacity:0}to{opacity:1}}
.cdk-sheet{--grn:#087a4b;--grn-d:#065c39;--grn-s:#e8f6ef;--blu-s:#eef4ff;--ink:#141d1a;--ink2:#3d4c47;--mut:#6b7b76;--line:#e4ebe8;--card:#fff;--card2:#f7faf9;--r2:10px;
  position:fixed;z-index:145;background:var(--card);box-shadow:0 -8px 40px rgba(0,0,0,.25);color:var(--ink);
  font-family:"SolaimanLipi","Noto Sans Bengali","Hind Siliguri","Nirmala UI",system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:15px;line-height:1.65}
[data-theme="dark"] .cdk-sheet{--ink:#e8f0ec;--ink2:#c2d0cb;--mut:#8b9c96;--line:#22302c;--card:#141f1c;--card2:#1a2724;--grn-s:#0d2c20;--blu-s:#111d33}
.cdk-sheet *{box-sizing:border-box}
.cdk-sheet button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
.cdk-sheet svg{display:block;flex:none}
@media(max-width:719px){
  .cdk-sheet{left:0;right:0;bottom:0;max-height:92vh;overflow-y:auto;border-radius:20px 20px 0 0;animation:cdkup .24s cubic-bezier(.2,.9,.3,1);
    padding-bottom:env(safe-area-inset-bottom)}
  .cdk-sheet .grab{width:38px;height:4px;border-radius:9px;background:var(--line);margin:9px auto 2px}
}
@keyframes cdkup{from{transform:translateY(100%)}to{transform:none}}
@media(min-width:720px){
  .cdk-sheet{top:50%;left:50%;transform:translate(-50%,-50%);width:min(520px,calc(100vw - 32px));
    max-height:88vh;overflow-y:auto;border-radius:16px;animation:cdkpop .2s}
  .cdk-sheet .grab{display:none}
}
@keyframes cdkpop{from{opacity:0;transform:translate(-50%,-46%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%)}}
.cdk-sheet .hd{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;position:sticky;top:0;background:var(--card);z-index:2}
.cdk-sheet .hd h3{margin:0;font-size:1rem;font-weight:800;flex:1;color:var(--ink)}
.cdk-sheet .bd{padding:0 16px 16px}
.cdk-sheet .ft{display:flex;gap:9px;padding:12px 16px;border-top:1px solid var(--line);position:sticky;bottom:0;background:var(--card)}
.cdk-sheet .ft .btn{flex:1}
.cdk-sheet .x{width:34px;height:34px;min-height:0;padding:0;border-radius:50%;display:grid;place-items:center;color:var(--mut);background:none;border:0}
.cdk-sheet .opt{display:flex;gap:11px;align-items:flex-start;padding:13px;margin-bottom:9px;border:1.5px solid var(--line);
  border-radius:12px;background:var(--card);transition:.15s;cursor:pointer}
.cdk-sheet .opt:hover{border-color:#b9d9c9;background:var(--card2)}
.cdk-sheet .opt.on{border-color:var(--grn);background:var(--grn-s)}
.cdk-sheet .opt b{display:block;font-size:.85rem;color:var(--ink)}
.cdk-sheet .opt small{display:block;font-size:.76rem;color:var(--ink2);margin-top:1px}
.cdk-sheet .opt small.mut{color:var(--mut)}
.cdk-sheet .note{display:flex;gap:9px;padding:12px 14px;border-radius:var(--r2);font-size:.79rem;line-height:1.6;margin:0 0 12px}
.cdk-sheet .note svg{margin-top:2px}
.cdk-sheet .note.i{background:var(--blu-s);color:#1c4b96}
[data-theme="dark"] .cdk-sheet .note.i{color:#8fb8f7}
.cdk-sheet .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 18px;
  border-radius:var(--r2);background:var(--grn);color:#fff;font-size:.85rem;font-weight:800;transition:.14s;border:1px solid transparent;
  width:auto;margin:0;text-transform:none;letter-spacing:normal;box-shadow:none}
.cdk-sheet .btn:hover{background:var(--grn-d)}
.cdk-sheet .btn:active{transform:scale(.985)}
.cdk-sheet .btn.gh{background:var(--card);border-color:var(--line);color:var(--ink)}
.cdk-sheet .btn.gh:hover{background:var(--card2)}
`;
  function ensureSheetCss(){
    if(document.getElementById("cdk-sheet-css"))return;
    const st=document.createElement("style");
    st.id="cdk-sheet-css";
    st.textContent=SHEET_CSS;
    document.head.appendChild(st);
  }

  /* মেইন ওয়েবসাইটে "কার্ড নামান" sheet খোলে — Doner প্যানেলের sheetDownload()-এর
     হুবহু আচরণ: ৩টি অপশন (ডিফল্ট "both"), বাতিল/ওভারলে-ক্লিকে বন্ধ,
     "নামান" চাপলে onDownload(kind)। */
  export function openDonorCardDownloadSheet(onDownload){
    ensureSheetCss();
    const ov=document.createElement("div");ov.className="cdk-ov";
    const sh=document.createElement("div");sh.className="cdk-sheet";
    sh.innerHTML=`<div class="grab"></div>
      <div class="hd"><h3>কার্ড নামান</h3><button class="x" data-close aria-label="বন্ধ" type="button">${SHEET_ICON.x(19)}</button></div>
      <div class="bd">${donorCardSheetBodyHTML()}</div>
      <div class="ft"><button class="btn gh" data-close type="button">বাতিল</button><button class="btn" data-ok type="button">${SHEET_ICON.down(15)} নামান</button></div>`;
    document.body.append(ov,sh);
    const prevOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const close=()=>{ov.remove();sh.remove();document.body.style.overflow=prevOverflow};
    ov.onclick=close;
    sh.addEventListener("click",e=>{if(e.target.closest("[data-close]"))close()});
    let kind="both";
    sh.querySelectorAll(".opt").forEach(o=>o.onclick=()=>{
      sh.querySelectorAll(".opt").forEach(z=>z.classList.remove("on"));o.classList.add("on");kind=o.dataset.k});
    sh.querySelector("[data-ok]").onclick=()=>{const k=kind;close();onDownload&&onDownload(k)};
    return sh;
  }
