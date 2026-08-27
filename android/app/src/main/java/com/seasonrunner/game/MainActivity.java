package com.seasonrunner.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {

    private static final String TAG = "SeasonRunner";
    private static final String GAME_URL = "file:///android_asset/web/index.html";

    private ViewGroup root;
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen immersive game
        requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // v1.0.2: make sure the *window* is hardware accelerated too. Some devices
        // ignore android:hardwareAccelerated for the WebView's window, which is a
        // classic cause of a black / blank WebView.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        root = new android.widget.FrameLayout(this);
        root.setBackgroundColor(0xFF0B1B26);
        webView = createWebView();
        root.addView(webView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        webView.loadUrl(GAME_URL);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createWebView() {
        WebView v = new WebView(this);
        v.setBackgroundColor(0xFF0B1B26);
        v.setVerticalScrollBarEnabled(false);
        v.setHorizontalScrollBarEnabled(false);
        v.setScrollbarFadingEnabled(true);

        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        // file:// pages get an opaque origin; without this some sub-resource loads
        // (fonts, worker scripts) silently fail on older WebViews.
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setLoadsImagesAutomatically(true);
        s.setTextZoom(100);

        v.setWebViewClient(new GameWebViewClient());
        v.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                // Surfaces JS errors in logcat — handy when debugging a black screen.
                Log.d(TAG, "console: " + cm.message() + " @" + cm.sourceId() + ":" + cm.lineNumber());
                return true;
            }
        });

        v.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        return v;
    }

    private class GameWebViewClient extends WebViewClient {

        @Override
        public void onPageFinished(WebView view, String url) {
            // The page sometimes lays out after this callback; nudge a resize so the
            // canvas never stays at a stale (or zero) size.
            view.loadUrl("javascript:(function(){try{window.dispatchEvent(new Event('resize'));}catch(e){}})()");
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            Log.e(TAG, "load error " + errorCode + ": " + description);
            Toast.makeText(MainActivity.this, "تعذّر تحميل اللعبة، جارٍ إعادة المحاولة…", Toast.LENGTH_LONG).show();
            view.postDelayed(() -> view.loadUrl(GAME_URL), 1200);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && request.isForMainFrame()) {
                Log.e(TAG, "main frame load error: " + (error != null ? error.getDescription() : "?"));
                Toast.makeText(MainActivity.this, "تعذّر تحميل اللعبة، جارٍ إعادة المحاولة…", Toast.LENGTH_LONG).show();
                view.postDelayed(() -> view.loadUrl(GAME_URL), 1200);
            }
        }

        /**
         * v1.0.2 — if the renderer process is killed (low memory / GPU crash) the
         * WebView is left showing a black screen. Recreate it instead of dying.
         */
        @Override
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            boolean crashed = detail != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && detail.didCrash();
            Log.w(TAG, "renderer gone (crash=" + crashed + ") — recreating WebView");
            if (view != null) {
                try {
                    ((ViewGroup) view.getParent()).removeView(view);
                    view.destroy();
                } catch (Throwable t) {
                    Log.w(TAG, "cleanup failed", t);
                }
            }
            webView = createWebView();
            root.addView(webView, 0, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            webView.loadUrl(GAME_URL);
            return true;   // we handled it
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request != null && request.getUrl() != null ? request.getUrl().toString() : "";
            // keep everything inside the game; only http(s) links leave the app
            if (url.startsWith("http://") || url.startsWith("https://")) {
                try {
                    startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,
                            android.net.Uri.parse(url)));
                } catch (Throwable t) {
                    Log.w(TAG, "no browser for " + url);
                }
                return true;
            }
            return false;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && Build.VERSION.SDK_INT >= 19) {
            webView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    protected void onPause() {
        // Without pause/resumeTimers the WebView keeps (or loses) timers across a
        // background round-trip, which froze the game loop on some devices.
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers();
            webView.onResume();
        }
        if (Build.VERSION.SDK_INT >= 19) {
            webView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            try {
                ((ViewGroup) webView.getParent()).removeView(webView);
            } catch (Throwable ignored) {}
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
