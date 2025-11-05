import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (_env, argv) => {
  const isProduction = argv.mode === 'production';
  const publicPath = process.env.PUBLIC_PATH ?? '/';

  return {
    entry: path.resolve(__dirname, 'src/main.tsx'),
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? 'assets/[name].[contenthash].js' : 'assets/[name].js',
      chunkFilename: isProduction ? 'assets/[name].[contenthash].js' : 'assets/[name].js',
      assetModuleFilename: 'assets/[hash][ext][query]',
      publicPath,
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      alias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          include: path.resolve(__dirname, 'src'),
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: path.resolve(__dirname, 'tsconfig.app.json'),
            },
          },
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|ico)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public/index.html'),
        favicon: path.resolve(__dirname, 'public/favicon.svg'),
      }),
      ...(isProduction
        ? [
            new CopyWebpackPlugin({
              patterns: [
                {
                  from: path.resolve(__dirname, 'public'),
                  to: path.resolve(__dirname, 'dist'),
                  globOptions: {
                    ignore: ['**/index.html'],
                  },
                },
              ],
            }),
          ]
        : []),
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    devServer: {
      static: {
        directory: path.resolve(__dirname, 'public'),
        watch: true,
      },
      historyApiFallback: true,
      port: 5173,
      hot: true,
      client: {
        overlay: true,
      },
      open: false,
    },
    stats: 'errors-warnings',
    performance: false,
  };
};
