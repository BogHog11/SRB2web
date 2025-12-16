const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
try {
  require("fs").rmSync("./launcher-dist", { recursive: true });
} catch (e) {}

module.exports = {
  mode: "production",
  devServer: {
    allowedHosts: "all",
    port: 3000,
    client: {
      overlay: {
        errors: true, // Keep displaying errors
        warnings: false, // Disable displaying warnings
        runtimeErrors: true, // Keep displaying runtime errors
      },
    },
  },
  cache: {
    type: "filesystem",
    allowCollectingMemory: true,
  },
  devtool: false,
  entry: {
    interface: "./launcher-src/index.js",
  },
  optimization: {
    splitChunks: {
      chunks: "all",
      name: "shared",
    },
    //minimize: false
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].bundle.js",
  },
  performance: {
    /*hints: "warning",*/
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          {
            loader: "raw-loader",
            options: {
              esModule: false,
            },
          },
        ],
        type: "javascript/auto", // Fix for raw-loader
      }
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: `index.html`,
      title: `Sonic Robo Blast 2 Web`,
      template: "./src/base_html.html",
      chunks: ["interface"],
    }),
    new CopyWebpackPlugin({
      patterns: [
        //Images and anything displayed on the site.
        {
          from: "./static",
          to: ".",
          noErrorOnMissing: true,
        },
        //The game without assets.
        {
          from: "./build-wasm/bin/",
          to: ".",
          noErrorOnMissing: true,
        },
        //Assets 
        {
          from: "./static",
          to: ".",
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};