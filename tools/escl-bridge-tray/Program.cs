// Roma Office Sharing - local eSCL scanner bridge, as a Windows tray application.
//
// Same HTTP API as scripts/escl-bridge.ts (kept for development), but a tiny native exe: it runs
// without Node, starts with Windows, and lives in the notification area next to the clock.
// Build with tools\escl-bridge-tray\build.cmd (uses the C# 5 compiler shipped with Windows).
//
//   GET  /ping
//   GET  /capabilities?host=<scanner-ip>&port=&https=1
//   POST /scan   { host, port?, https?, resolution?, color?, source?, pageSize? }
//
// Listens on 127.0.0.1 only (no auth): never expose it on the network.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Roma Office Sharing - Scanner Bridge")]
[assembly: AssemblyProduct("Roma Office Sharing Scanner Bridge")]
[assembly: AssemblyVersion("0.2.0.0")]

namespace RomaOfficeSharing.ScannerBridge
{
    static class Program
    {
        public const string Version = "escl-bridge-0.2-tray";
        const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        const string RunValueName = "RomaOfficeSharingScannerBridge";
        const string AppKeyPath = @"Software\RomaOfficeSharing\ScannerBridge";

        [STAThread]
        static void Main(string[] args)
        {
            int port = 17866;
            if (args.Length > 0 && !int.TryParse(args[0], out port)) port = 17866;
            if (port < 1 || port > 65535) port = 17866;

            bool createdNew;
            using (Mutex mutex = new Mutex(true, "Local\\RomaOfficeSharing.ScannerBridge." + port, out createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show("Il bridge scanner è già in esecuzione sulla porta " + port + ".\nTrovi l'icona accanto all'orologio di Windows.",
                        "Roma Office Sharing - Bridge scanner", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }

                BridgeServer server = new BridgeServer(port);
                try { server.Start(); }
                catch (SocketException)
                {
                    MessageBox.Show("La porta " + port + " è già occupata da un altro programma.\nChiudilo oppure avvia il bridge con un'altra porta (es. RomaOfficeSharing-ScannerBridge.exe 17867).",
                        "Roma Office Sharing - Bridge scanner", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                bool firstRun = false;
                try
                {
                    using (RegistryKey app = Registry.CurrentUser.CreateSubKey(AppKeyPath))
                    {
                        if (app.GetValue("FirstRunDone") == null) { SetAutostart(true, port); app.SetValue("FirstRunDone", 1); firstRun = true; }
                    }
                    // Keep an existing autostart entry pointing at the exe that is actually running (it may have been moved).
                    if (IsAutostart()) SetAutostart(true, port);
                }
                catch (Exception) { }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new TrayContext(port, firstRun));
                server.Stop();
            }
        }

        public static bool IsAutostart()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKeyPath, false))
                return key != null && key.GetValue(RunValueName) != null;
        }

        public static void SetAutostart(bool enabled, int port)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKeyPath))
            {
                if (enabled) key.SetValue(RunValueName, "\"" + Application.ExecutablePath + "\" " + port);
                else key.DeleteValue(RunValueName, false);
            }
        }
    }

    class TrayContext : ApplicationContext
    {
        readonly NotifyIcon icon;
        readonly ContextMenuStrip menu;
        readonly ToolStripMenuItem autostartItem;

        public TrayContext(int port, bool firstRun)
        {
            ToolStripMenuItem title = new ToolStripMenuItem("Roma Office Sharing - Bridge scanner");
            title.Enabled = false;
            title.Font = new Font(title.Font, FontStyle.Bold);
            ToolStripMenuItem portItem = new ToolStripMenuItem("In ascolto sulla porta " + port + "  (127.0.0.1)");
            portItem.Enabled = false;
            autostartItem = new ToolStripMenuItem("Avvia con Windows");
            autostartItem.Checked = Program.IsAutostart();
            autostartItem.Click += delegate
            {
                bool enable = !autostartItem.Checked;
                try { Program.SetAutostart(enable, port); autostartItem.Checked = enable; }
                catch (Exception ex) { MessageBox.Show("Impossibile modificare l'avvio automatico: " + ex.Message); }
            };
            ToolStripMenuItem exitItem = new ToolStripMenuItem("Esci");
            exitItem.Click += delegate { Quit(); };

            menu = new ContextMenuStrip();
            menu.Items.Add(title);
            menu.Items.Add(portItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(autostartItem);
            menu.Items.Add(exitItem);

            icon = new NotifyIcon();
            icon.Icon = LoadIcon();
            icon.Text = "Bridge scanner - porta " + port;
            icon.ContextMenuStrip = menu;
            icon.Visible = true;
            // Right click opens the menu on its own; make a left click open it too.
            icon.MouseClick += delegate(object s, MouseEventArgs e)
            {
                if (e.Button != MouseButtons.Left) return;
                MethodInfo show = typeof(NotifyIcon).GetMethod("ShowContextMenu", BindingFlags.Instance | BindingFlags.NonPublic);
                if (show != null) show.Invoke(icon, null);
            };
            icon.ShowBalloonTip(4000, "Bridge scanner attivo",
                "In ascolto sulla porta " + port + "." + (firstRun ? "\nSi avvierà automaticamente con Windows." : ""), ToolTipIcon.Info);
        }

        static Icon LoadIcon()
        {
            try
            {
                Icon big = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (big != null) return new Icon(big, SystemInformation.SmallIconSize);
            }
            catch (Exception) { }
            return SystemIcons.Application;
        }

        void Quit()
        {
            icon.Visible = false;
            icon.Dispose();
            menu.Dispose();
            ExitThread();
        }
    }

    class ScanError : Exception
    {
        public readonly string Code;
        public ScanError(string code, string message) : base(message) { Code = code; }
    }

    class Request
    {
        public string Method, Path;
        public Dictionary<string, string> Query = new Dictionary<string, string>();
        public byte[] Body = new byte[0];
    }

    class BridgeServer
    {
        const int MaxBodyBytes = 1024 * 1024;
        readonly int port;
        readonly object scanLock = new object();
        TcpListener listener;
        volatile bool running;

        public BridgeServer(int port) { this.port = port; }

        public void Start()
        {
            listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
            running = true;
            Thread t = new Thread(AcceptLoop);
            t.IsBackground = true;
            t.Start();
        }

        public void Stop()
        {
            running = false;
            try { listener.Stop(); } catch (Exception) { }
        }

        void AcceptLoop()
        {
            while (running)
            {
                TcpClient client;
                try { client = listener.AcceptTcpClient(); }
                catch (Exception) { break; }
                ThreadPool.QueueUserWorkItem(delegate { Handle(client); });
            }
        }

        void Handle(TcpClient client)
        {
            try
            {
                using (client)
                {
                    client.ReceiveTimeout = 15000;
                    client.SendTimeout = 30000;
                    NetworkStream stream = client.GetStream();
                    Request req = ReadRequest(stream);
                    if (req == null) return;
                    Route(stream, req);
                }
            }
            catch (Exception) { }
        }

        static Request ReadRequest(NetworkStream s)
        {
            MemoryStream buf = new MemoryStream();
            byte[] tmp = new byte[8192];
            int headerEnd = -1;
            while (headerEnd < 0)
            {
                int n = s.Read(tmp, 0, tmp.Length);
                if (n <= 0) return null;
                buf.Write(tmp, 0, n);
                headerEnd = IndexOfHeaderEnd(buf.GetBuffer(), (int)buf.Length);
                if (headerEnd < 0 && buf.Length > 65536) return null;
            }
            byte[] all = buf.ToArray();
            string head = Encoding.ASCII.GetString(all, 0, headerEnd);
            string[] lines = head.Split(new string[] { "\r\n" }, StringSplitOptions.None);
            string[] first = lines[0].Split(' ');
            if (first.Length < 2) return null;

            Request req = new Request();
            req.Method = first[0].ToUpperInvariant();
            string target = first[1];
            int q = target.IndexOf('?');
            req.Path = q < 0 ? target : target.Substring(0, q);
            if (q >= 0)
                foreach (string pair in target.Substring(q + 1).Split(new char[] { '&' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    int eq = pair.IndexOf('=');
                    string key = Uri.UnescapeDataString(eq < 0 ? pair : pair.Substring(0, eq));
                    string val = eq < 0 ? "" : Uri.UnescapeDataString(pair.Substring(eq + 1).Replace('+', ' '));
                    req.Query[key] = val;
                }

            int contentLength = 0;
            for (int i = 1; i < lines.Length; i++)
            {
                int c = lines[i].IndexOf(':');
                if (c > 0 && lines[i].Substring(0, c).Trim().ToLowerInvariant() == "content-length")
                    int.TryParse(lines[i].Substring(c + 1).Trim(), out contentLength);
            }
            if (contentLength > MaxBodyBytes) return null;
            int bodyStart = headerEnd + 4;
            MemoryStream body = new MemoryStream();
            body.Write(all, bodyStart, all.Length - bodyStart);
            while (body.Length < contentLength)
            {
                int n = s.Read(tmp, 0, tmp.Length);
                if (n <= 0) break;
                body.Write(tmp, 0, n);
            }
            req.Body = body.ToArray();
            return req;
        }

        static int IndexOfHeaderEnd(byte[] b, int len)
        {
            for (int i = 0; i + 3 < len; i++)
                if (b[i] == 13 && b[i + 1] == 10 && b[i + 2] == 13 && b[i + 3] == 10) return i;
            return -1;
        }

        void Route(NetworkStream s, Request req)
        {
            if (req.Method == "OPTIONS") { Reply(s, 204, ""); return; }

            if (req.Method == "GET" && req.Path == "/ping")
            {
                Reply(s, 200, "{\"ok\":true,\"version\":" + Json.Q(Program.Version) + "}");
                return;
            }

            if (req.Method == "GET" && req.Path == "/capabilities")
            {
                string host;
                if (!req.Query.TryGetValue("host", out host) || host.Length == 0)
                { Reply(s, 400, "{\"ok\":false,\"message\":\"Parametro host mancante\"}"); return; }
                try
                {
                    string port = null; req.Query.TryGetValue("port", out port);
                    string https = null; req.Query.TryGetValue("https", out https);
                    string raw = Escl.GetCapabilities(host, string.IsNullOrEmpty(port) ? (int?)null : int.Parse(port), https == "1");
                    bool feeder = raw.Contains("Feeder") || raw.Contains("Adf");
                    Reply(s, 200, "{\"ok\":true,\"platenSupported\":" + Json.B(raw.Contains("Platen")) + ",\"feederSupported\":" + Json.B(feeder) + "}");
                }
                catch (Exception ex) { Reply(s, 502, "{\"ok\":false,\"message\":" + Json.Q(Escl.Describe(ex)) + "}"); }
                return;
            }

            if (req.Method == "POST" && req.Path == "/scan")
            {
                try
                {
                    Dictionary<string, object> p = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(req.Body));
                    string host = Json.Str(p, "host");
                    if (string.IsNullOrEmpty(host)) { Reply(s, 400, "{\"success\":false,\"message\":\"Parametro host mancante\"}"); return; }
                    List<byte[]> pages;
                    lock (scanLock) { pages = Escl.Scan(host, Json.Int(p, "port"), Json.Bool(p, "https"), Json.Int(p, "resolution") ?? 200,
                        Json.Str(p, "color") == "color", Json.Str(p, "source") ?? "platen", Json.Str(p, "pageSize") ?? "a4"); }
                    byte[] pdf = PdfBuilder.FromJpegs(pages);

                    StringBuilder sb = new StringBuilder();
                    sb.Append("{\"success\":true,\"pdf_base64\":\"").Append(Convert.ToBase64String(pdf)).Append("\",");
                    sb.Append("\"filename\":").Append(Json.Q("scan_" + DateTime.UtcNow.ToString("yyyy-MM-ddTHH-mm-ss-fffZ") + ".pdf")).Append(",\"pages\":[");
                    for (int i = 0; i < pages.Count; i++)
                    {
                        if (i > 0) sb.Append(',');
                        sb.Append("{\"base64\":\"").Append(Convert.ToBase64String(pages[i])).Append("\",\"isImage\":true,\"mimeType\":\"image/jpeg\"}");
                    }
                    sb.Append("]}");
                    Reply(s, 200, sb.ToString());
                }
                catch (ScanError ex) { Reply(s, 502, "{\"success\":false,\"code\":" + Json.Q(ex.Code) + ",\"message\":" + Json.Q(ex.Message) + "}"); }
                catch (Exception ex) { Reply(s, 502, "{\"success\":false,\"message\":" + Json.Q(Escl.Describe(ex)) + "}"); }
                return;
            }

            Reply(s, 404, "{\"ok\":false,\"message\":\"Non trovato\"}");
        }

        static void Reply(NetworkStream s, int status, string json)
        {
            string text = status == 200 ? "OK" : status == 204 ? "No Content" : status == 400 ? "Bad Request" : status == 404 ? "Not Found" : "Bad Gateway";
            byte[] body = Encoding.UTF8.GetBytes(json);
            StringBuilder h = new StringBuilder();
            h.Append("HTTP/1.1 ").Append(status).Append(' ').Append(text).Append("\r\n");
            h.Append("Content-Type: application/json; charset=utf-8\r\n");
            h.Append("Content-Length: ").Append(body.Length).Append("\r\n");
            h.Append("Access-Control-Allow-Origin: *\r\n");
            h.Append("Access-Control-Allow-Methods: GET,POST,OPTIONS\r\n");
            h.Append("Access-Control-Allow-Headers: Content-Type\r\n");
            h.Append("Access-Control-Allow-Private-Network: true\r\n");
            h.Append("Connection: close\r\n\r\n");
            byte[] head = Encoding.ASCII.GetBytes(h.ToString());
            s.Write(head, 0, head.Length);
            if (body.Length > 0) s.Write(body, 0, body.Length);
            s.Flush();
        }
    }

    static class Json
    {
        public static string B(bool v) { return v ? "true" : "false"; }

        public static string Q(string s)
        {
            StringBuilder sb = new StringBuilder("\"");
            foreach (char c in s)
            {
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else if (c == '\n') sb.Append("\\n");
                else if (c == '\r') sb.Append("\\r");
                else if (c == '\t') sb.Append("\\t");
                else if (c < 32) sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append('"').ToString();
        }

        public static string Str(Dictionary<string, object> d, string key)
        {
            object v; return d.TryGetValue(key, out v) && v != null ? Convert.ToString(v) : null;
        }

        public static int? Int(Dictionary<string, object> d, string key)
        {
            object v; if (!d.TryGetValue(key, out v) || v == null) return null;
            int n; return int.TryParse(Convert.ToString(v), out n) ? (int?)n : null;
        }

        public static bool Bool(Dictionary<string, object> d, string key)
        {
            object v; return d.TryGetValue(key, out v) && v is bool && (bool)v;
        }
    }

    class HttpResult
    {
        public int Status;
        public byte[] Body;
        public Uri Location;
        public string Text { get { return Encoding.UTF8.GetString(Body); } }
    }

    // Minimal eSCL (AirScan / Mopria) client - the same protocol steps as src/lib/escl-scanner.ts.
    static class Escl
    {
        const double UnitsPerInch = 300;
        const string AdfEmptyMessage = "Nessun foglio nell'alimentatore automatico (ADF), oppure lo scanner è occupato. Inserisci i fogli nel caricatore e riprova.";
        static readonly HttpClient Client = CreateClient();

        static HttpClient CreateClient()
        {
            HttpClient c = new HttpClient();
            c.Timeout = Timeout.InfiniteTimeSpan;
            return c;
        }

        static string BaseUrl(string host, int? port, bool https)
        {
            return (https ? "https" : "http") + "://" + host + ":" + (port ?? (https ? 443 : 80)) + "/eSCL";
        }

        static HttpResult Call(HttpMethod method, string url, string xmlBody, int timeoutMs)
        {
            using (CancellationTokenSource cts = new CancellationTokenSource(timeoutMs))
            using (HttpRequestMessage req = new HttpRequestMessage(method, url))
            {
                if (xmlBody != null)
                {
                    req.Content = new StringContent(xmlBody, new UTF8Encoding(false));
                    req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/xml");
                }
                try
                {
                    using (HttpResponseMessage resp = Client.SendAsync(req, cts.Token).Result)
                    {
                        HttpResult r = new HttpResult();
                        r.Status = (int)resp.StatusCode;
                        r.Body = resp.Content.ReadAsByteArrayAsync().Result;
                        r.Location = resp.Headers.Location;
                        return r;
                    }
                }
                catch (AggregateException ex) { throw ex.GetBaseException(); }
            }
        }

        public static string Describe(Exception ex)
        {
            if (ex is OperationCanceledException) return "Nessuna risposta dallo scanner (timeout)";
            if (ex is HttpRequestException || ex is WebException)
                return "Scanner non raggiungibile: " + (ex.InnerException != null ? ex.InnerException.Message : ex.Message);
            return ex.Message;
        }

        public static string GetCapabilities(string host, int? port, bool https)
        {
            HttpResult r = Call(HttpMethod.Get, BaseUrl(host, port, https) + "/ScannerCapabilities", null, 8000);
            if (r.Status < 200 || r.Status > 299) throw new Exception("ScannerCapabilities HTTP " + r.Status);
            return r.Text;
        }

        // Not every device reports the feeder state - null means "unknown", not "fine".
        static string GetAdfState(string baseUrl)
        {
            try
            {
                HttpResult r = Call(HttpMethod.Get, baseUrl + "/ScannerStatus", null, 5000);
                if (r.Status < 200 || r.Status > 299) return null;
                Match m = Regex.Match(r.Text, @"AdfState>\s*([A-Za-z]+)\s*<");
                return m.Success ? m.Groups[1].Value : null;
            }
            catch (Exception) { return null; }
        }

        static string AdfProblem(string state)
        {
            switch (state)
            {
                case "ScannerAdfEmpty": return AdfEmptyMessage;
                case "ScannerAdfJam": return "Inceppamento nell'alimentatore automatico (ADF): rimuovi i fogli inceppati e riprova.";
                case "ScannerAdfDoorOpen": return "Lo sportello dell'alimentatore automatico (ADF) è aperto: chiudilo e riprova.";
                case "ScannerAdfHatchOpen": return "Il coperchio dell'alimentatore automatico (ADF) è aperto: chiudilo e riprova.";
                case "ScannerAdfMultipickDetected": return "Lo scanner ha prelevato più fogli insieme (ADF): separa i fogli e riprova.";
                default: return null;
            }
        }

        static string SettingsXml(string source, bool color, int resolution, string pageSize)
        {
            double w = pageSize == "letter" ? 8.5 : 8.27, h = pageSize == "letter" ? 11 : 11.69;
            return "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
                + "<scan:ScanSettings xmlns:scan=\"http://schemas.hp.com/imaging/escl/2011/05/03\" xmlns:pwg=\"http://www.pwg.org/schemas/2010/12/sm\">\n"
                + "  <pwg:Version>2.0</pwg:Version>\n"
                + "  <pwg:ScanRegions>\n    <pwg:ScanRegion>\n"
                + "      <pwg:Height>" + (int)Math.Round(h * UnitsPerInch) + "</pwg:Height>\n"
                + "      <pwg:Width>" + (int)Math.Round(w * UnitsPerInch) + "</pwg:Width>\n"
                + "      <pwg:XOffset>0</pwg:XOffset>\n      <pwg:YOffset>0</pwg:YOffset>\n"
                + "    </pwg:ScanRegion>\n  </pwg:ScanRegions>\n"
                + "  <pwg:InputSource>" + (source == "platen" ? "Platen" : "Feeder") + "</pwg:InputSource>\n"
                + "  <scan:ColorMode>" + (color ? "RGB24" : "Grayscale8") + "</scan:ColorMode>\n"
                + "  <scan:XResolution>" + resolution + "</scan:XResolution>\n"
                + "  <scan:YResolution>" + resolution + "</scan:YResolution>\n"
                + "  <scan:Duplex>" + (source == "feederDuplex" ? "true" : "false") + "</scan:Duplex>\n"
                + "  <pwg:DocumentFormat>image/jpeg</pwg:DocumentFormat>\n"
                + "  <scan:DocumentFormatExt>image/jpeg</scan:DocumentFormatExt>\n"
                + "</scan:ScanSettings>";
        }

        public static List<byte[]> Scan(string host, int? port, bool https, int resolution, bool color, string source, string pageSize)
        {
            string baseUrl = BaseUrl(host, port, https);
            bool feeder = source != "platen";
            if (feeder)
            {
                string state = GetAdfState(baseUrl);
                string problem = state == null ? null : AdfProblem(state);
                if (problem != null) throw new ScanError(state == "ScannerAdfEmpty" ? "adf-empty" : "adf-error", problem);
            }

            HttpResult create = Call(HttpMethod.Post, baseUrl + "/ScanJobs", SettingsXml(source, color, resolution, pageSize), 10000);
            // HP devices answer 503 "Scanner busy" when asked to scan from an empty feeder.
            if (create.Status == 503 && feeder) throw new ScanError("adf-empty", AdfEmptyMessage);
            if (create.Status != 201) throw new Exception("ScanJobs HTTP " + create.Status + ": " + create.Text);
            if (create.Location == null) throw new Exception("Lo scanner non ha restituito l'indirizzo del lavoro di scansione");
            string jobUrl = (create.Location.IsAbsoluteUri ? create.Location : new Uri(new Uri(baseUrl), create.Location)).ToString().TrimEnd('/');

            try
            {
                List<byte[]> pages = new List<byte[]>();
                while (true)
                {
                    HttpResult page = Call(HttpMethod.Get, jobUrl + "/NextDocument", null, 60000);
                    if (page.Status == 404 || page.Status == 409) break;
                    if (page.Status < 200 || page.Status > 299) throw new Exception("NextDocument HTTP " + page.Status);
                    pages.Add(page.Body);
                    if (!feeder) break; // flatbed: exactly one page per job
                }
                if (pages.Count == 0) throw new Exception("Lo scanner non ha restituito alcuna pagina");
                return pages;
            }
            finally
            {
                try { Call(HttpMethod.Delete, jobUrl, null, 5000); } catch (Exception) { }
            }
        }
    }

    // One JPEG per PDF page, embedded as-is (DCTDecode) - no re-encoding, page size = image pixels.
    static class PdfBuilder
    {
        static bool JpegInfo(byte[] d, out int width, out int height, out int components)
        {
            width = height = components = 0;
            if (d.Length < 4 || d[0] != 0xFF || d[1] != 0xD8) return false;
            int i = 2;
            while (i + 9 < d.Length)
            {
                if (d[i] != 0xFF) { i++; continue; }
                byte m = d[i + 1];
                if (m == 0xFF) { i++; continue; }
                if (m == 0xD8 || m == 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
                int len = (d[i + 2] << 8) | d[i + 3];
                if (m >= 0xC0 && m <= 0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC)
                {
                    height = (d[i + 5] << 8) | d[i + 6];
                    width = (d[i + 7] << 8) | d[i + 8];
                    components = d[i + 9];
                    return true;
                }
                i += 2 + len;
            }
            return false;
        }

        public static byte[] FromJpegs(List<byte[]> jpegs)
        {
            MemoryStream o = new MemoryStream();
            List<long> offsets = new List<long>();
            Action<string> write = delegate(string s) { byte[] b = Encoding.ASCII.GetBytes(s); o.Write(b, 0, b.Length); };
            Action<int> begin = delegate(int id) { offsets.Add(o.Position); write(id + " 0 obj\n"); };

            write("%PDF-1.4\n");
            offsets.Add(-1); // object ids start at 1
            begin(1); write("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
            begin(2);
            StringBuilder kids = new StringBuilder();
            for (int i = 0; i < jpegs.Count; i++) kids.Append(3 + 3 * i).Append(" 0 R ");
            write("<< /Type /Pages /Count " + jpegs.Count + " /Kids [" + kids + "] >>\nendobj\n");

            for (int i = 0; i < jpegs.Count; i++)
            {
                int w, h, comps;
                if (!JpegInfo(jpegs[i], out w, out h, out comps))
                    throw new Exception("Lo scanner ha restituito una pagina che non è un JPEG: formato non supportato dal bridge.");
                int pageId = 3 + 3 * i, contentId = pageId + 1, imageId = pageId + 2;
                string cs = comps == 1 ? "/DeviceGray" : comps == 4 ? "/DeviceCMYK" : "/DeviceRGB";
                string content = "q " + w + " 0 0 " + h + " 0 0 cm /Im0 Do Q";

                begin(pageId);
                write("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + w + " " + h + "] /Resources << /XObject << /Im0 " + imageId + " 0 R >> >> /Contents " + contentId + " 0 R >>\nendobj\n");
                begin(contentId);
                write("<< /Length " + content.Length + " >>\nstream\n" + content + "\nendstream\nendobj\n");
                begin(imageId);
                write("<< /Type /XObject /Subtype /Image /Width " + w + " /Height " + h + " /ColorSpace " + cs + " /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpegs[i].Length + " >>\nstream\n");
                o.Write(jpegs[i], 0, jpegs[i].Length);
                write("\nendstream\nendobj\n");
            }

            long xref = o.Position;
            int count = offsets.Count;
            write("xref\n0 " + count + "\n0000000000 65535 f \n");
            for (int id = 1; id < count; id++) write(offsets[id].ToString("0000000000") + " 00000 n \n");
            write("trailer\n<< /Size " + count + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
            return o.ToArray();
        }
    }
}
