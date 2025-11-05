const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const publicPath = process.env.PUBLIC_PATH || '/';

module.exports = {
  entry: path.resolve(__dirname, 'src/main.tsx'),
  output: {
    filename: 'assets/[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath,
    clean: true
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            transpileOnly: false,
            compilerOptions: {
              noEmit: false
            }
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.fx$/i,
        type: 'asset/source'
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'index.html')
    })
  ],
  devtool: 'source-map',
  devServer: {
    historyApiFallback: true,
    hot: true,
    port: 5184
  }
};
