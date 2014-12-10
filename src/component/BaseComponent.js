/**
 * @file fc-view/component/BaseComponent 基础类
 * 本类提供一个可复用的组件化机制下的基础Component类，本类为虚类，请使用实体类
 *
 * @author Leo Wang(wangkemiao@baidu.com)
 */

define(function (require) {

    var _ = require('underscore');
    var fc = require('fc-core');
    var fcui = require('fcui');
    var EventTarget = require('fc-core/EventTarget');
    var Promise = require('fc-core/Promise');
    var ViewContext = require('fcui/ViewContext');
    var LifeStage = require('./LifeStage');
    var BaseModel = require('../mvc/BaseModel');

    require('fcui/Panel');
    require('fcui/Dialog');


    /**
     * 判断是否支持html5
     * @return {boolean}
     */
    var supportHtml5 = (function () {
        try {
            document.createElement('canvas').getContext('2d');
            return true;
        }
        catch (e) {
            return false;
        }
    })();

    /**
     * 默认样式类
     * @type {string}
     */
    var BASIC_CLASS = 'component-basic';

    /**
     * BaseComponent类
     * @class BaseComponent
     * @extends fc.EventTarget
     *
     * 生命周期：using LifeStage
     * NEW -> INITED -> RENDERED -> REPAINTED -> DISPOSE
     *
     * 对外事件暴露
     * BaseComponent#inited 初始化完成
     * BaseComponent#rendered 渲染完成
     * BaseComponent#repainted 重绘完成
     * BaseComponent#disposed 销毁完成
     * BaseComponent#showed
     * BaseComponent#closed 界面关闭 之后会自动触发销毁
     * BaseComponent#loading 标记为加载中，仅在Model为异步时或者子Action模式时触发
     * BaseComponent#loaded 标记为加载完成，仅在Model为异步时或者子Action模式时触发
     *
     * 环境访问
     * 获取UI：
     * instance.get(id)
     * instance.getSafely(id)
     * instance.getGroup(groupid)
     *
     * 视图控制
     * 展现界面：instance.show()
     * 隐藏界面：instance.hide()
     * 销毁界面：instance.close()
     *
     * 交互控制
     * 交互处理方法：initBehavior
     *
     */
    var overrides = {};
    /**
     * 构造函数
     * @constructor
     * @param {Object} options 配置
     * @param {ViewContext} options.viewContext ui环境
     * @param {BaseModel} options.model 数据Model
     * @param {HtmlElement | string} container 容器
     * @param {string} template 模板内容
     */
    overrides.constructor = function (options) {
        this.guid = fc.util.guid();
        this.name += '-' + this.guid;
        this.lifeStage = new LifeStage(this);

        // 处理options
        this.initOptions(options);

        // 提供手动初始化
        this.initialize();

        // 请注意，生命周期的改变会自动fire同名事件
        this.lifeStage.changeTo(LifeStage.INITED);
    };

    /**
     * 处理配置，转为类的属性
     * @param {Object} options 配置
     * @param {ViewContext} options.viewContext ui环境
     * @param {BaseModel} options.model 数据Model
     * @param {Object=} options.args 额外的数据，可用于Model初始化使用
     * @param {HtmlElement | string} options.container 容器
     * @param {string} options.template 模板内容
     * @param {Object=} options.dialogOptions 对话框模式的配置
     */
    overrides.initOptions = function (options) {
        options = options || {};

        // kuanghongrui
        // 以下需要对空进行判断，
        // 要不然第一次初始化参数后，再次执行该方法时，将会被覆盖。
        if (options.viewContext) {
            this.viewContext = options.viewContext;
        }
        if (options.model) {  // 意味传入了model，此时model为共享
            this.model = options.model;
        }
        if (options.container) {
            this.container = options.container;
        }
        if (options.template) {
            this.template = options.template;
        }

        if (this.model) {
            // 如果直接传入了Model，不再请求
            this.needToLoad = false;
        }
        else {
            this.needToLoad = true;
        }

        this.args = options.args || this.args;
        this.dialogOptions = _.extend(
            this.dialogOptions || {}, options.dialogOptions
        );
        this.dialogOptions.closeOnHide = true;  // 强制隐藏关闭（销毁）
    };

    /**
     * 基础类名
     * @type {string}
     */
    overrides.name = 'component';

    /**
     * 手动初始化方法
     */
    overrides.initialize = _.noop;

    /**
     * 获取ViewContext
     * @return {fcui.ViewContext}
     */
    overrides.getViewContext = function () {
        if (!this.viewContext) {
            this.viewContext = new ViewContext(this.name);
        }
        return this.viewContext;
    };

    /**
     * 获取主体容器的样式
     * @return {string}
     */
    overrides.getClassName = function () {
        return this.className || '';
    };

    /**
     * 失败处理
     * @param {mini-Event.Event} e 错误事件参数
     */
    overrides.handleError = function (e) {
        fc.util.processError(e);
    };

    /**
     * 获取环境内的UI实例
     * @param {string} id UI控件的id
     * @return {Object}
     */
    overrides.get = function (id) {
        return this.viewContext.get(id);
    };

    /**
     * 根据id获取控件实例，如无相关实例则返回{@link SafeWrapper}
     *
     * @param {string} id 控件id
     * @return {Control} 根据id获取的控件
     */
    overrides.getSafely = function (id) {
        return this.viewContext.getSafely(id);
    };

    /**
     * 获取一个控件分组
     *
     * @param {string} groupid 分组名称
     * @return {ControlGroup}
     */
    overrides.getGroup = function (groupid) {
        if (!groupid) {
            throw new Error('groupid is unspecified');
        }

        return this.viewContext.getGroup(groupid);
    };

    /**
     * model对象
     * @type {?meta.Model|Object}
     */
    overrides.model = null;

    /**
     * model类名，构造器
     * @type {?Model}
     */
    overrides.modelType = null;

    /**
     * 获取数据对象
     * @return {Promise|meta.Model|Object} Promise对象或者Model对象或Object
     */
    overrides.getModel = function () {
        if (!this.model) {
            if (this.modelType) {
                // fecs……
                var ModelType = this.modelType;
                this.model = new ModelType(this.args);
            }
            else {
                this.model = new BaseModel(this.args);
            }
        }
        else if (!(this.model instanceof BaseModel)) {
            this.model = new BaseModel(this.model);
        }
        return this.model;
    };

    /**
     * 获取模板数据
     * @return {Object} 为etpl定制的templateData
     */
    overrides.getTemplatedData = function () {

        var model = this.getModel();
        if (Promise.isPromise(model)) {
            return {};
        }

        if (model && typeof model.get !== 'function') {
            var Model = require('../mvc/BaseModel');
            model = new Model(model);
        }

        var visit = function (propertyPath) {
            var path = propertyPath.replace(/\[(\d+)\]/g, '.$1').split('.');
            var propertyName = path.shift();
            var value = model.get(propertyName);

            while (value && (propertyName = path.shift())) {
                value = value[propertyName];
            }

            return value;
        };

        return {get: visit, relatedModel: model};
    };

    /**
     * UI配置
     * @property
     * @type {?Object}
     */
    overrides.uiProperties = null;

    /**
     * UI配置获取方法
     * @return {Object}
     */
    overrides.getUIProperties = function () {
        return this.uiProperties || {};
    };

    /**
     * UI事件配置
     * @property
     * @type {?Object}
     * @this {BaseComponent}
     */
    overrides.uiEvents = null;

    /**
     * UI事件配置获取方法
     * @return {Object}
     */
    overrides.getUIEvents = function () {
        return this.uiEvents || {};
    };

    /**
     * 线性获取值的方法…… 例如getProperty(a, 'b.c')相当于a.b.c或a.get(b).c
     * @param {Object} target 数据所在
     * @param {string} path 获取路径
     * @return {*}
     */
    function getProperty(target, path) {
        var value = target;
        for (var i = 0; i < path.length; i++) {
            value = value[path[i]];
        }

        return value;
    }

    /**
     * 替换元素属性中的特殊值，模式与view.BaseView一致
     *
     * @param {string} value 需要处理的值
     * @return {*} 处理完的值
     * @public
     */
    overrides.replaceValue = function (value) {
        if (typeof value !== 'string') {
            return value;
        }

        if (value === '@@' || value === '**') {
            return this.getModel();
        }

        var prefix = value.charAt(0);
        var actualValue = value.substring(1);

        if (prefix === '@' || prefix === '*') {
            var path = actualValue.split('.');
            var result = typeof this.model.get === 'function'
                ? this.model.get(path[0])
                : this.model[path[0]];
            return path.length > 1
                ? getProperty(result, path.slice(1))
                : result;
        }

        return value;
    };

    function getClassName() {
        var classNames = [BASIC_CLASS];
        if (supportHtml5) {
            classNames.push('html5');
        }
        var thisClassName = this.getClassName();
        if (thisClassName) {
            classNames.push(thisClassName);
        }
        return classNames.join(' ');
    }

    /**
     * 创建主体容器
     */
    overrides.initStructure = function () {

        var viewContext = this.getViewContext();

        if (typeof this.container === 'string') {
            this.container = document.getElementById(this.container);
        }

        var me = this;
        var defaultOpts = {
            id: me.name,
            main: me.container,
            viewContext: viewContext,
            needFoot: true,
            renderOptions: {
                properties: me.getUIProperties(),
                valueReplacer: _.bind(me.replaceValue, me)
            }
        };

        if (!me.container) {
            // 创建容器元素
            me.container = document.createElement('div');
            me.container.id = me.name;
            document.body.appendChild(me.container);
            // 创建Dialog
            me.control = fcui.create(
                'Dialog',
                _.deepExtend(defaultOpts, me.dialogOptions, {
                    main: me.container
                })
            );

            // 部分事件代理过来
            me.control.on('close', function () {
                me.fire('hide');
            });
            me.control.on('hide', function () {
                me.fire('hide');
            });

            // 立即展现
            me.control.show();
        }
        else {
            me.control = fcui.create('Panel', defaultOpts);
            me.control.render();
        }

        // 增加className
        me.container.className += ' ' + getClassName.call(me);
    };

    overrides.prepare = _.noop;


    /**
     * 模板的HTML，优先级高于templateName
     */
    overrides.template = null;

    /**
     * 模板的名称
     */
    overrides.templateName = null;

    /**
     * loading的HTML，优先级高于loadingTemplateName
     */
    overrides.loadingTemplate = null;

    /**
     * loading的模板名称
     */
    overrides.loadingTemplateName = null;

    /**
     * 主体内容渲染器
     * @param {Object|meta.Model} data 数据
     * @return {string} 主体内容的HTML
     */
    overrides.renderer = null;
    overrides.getRenderer = function () {
        if (this.renderer == null) {
            // 渲染器
            if (this.template) {
                this.renderer = fc.tpl.compile(this.template);
            }
            else if (this.templateName) {
                this.renderer = fc.tpl.getRenderer(this.templateName);
            }

            if (!this.renderer) {
                this.renderer = function () {
                    return '';
                };
            }
        }
        return this.renderer;
    };

    /**
     * loading内容渲染器
     */
    overrides.loadingRenderer = null;
    overrides.getLoadingRenderer = function () {
        if (this.renderer == null) {
            // 渲染器
            if (this.loadingTemplate) {
                this.loadingRenderer = fc.tpl.compile(this.loadingTemplate);
            }
            else if (this.loadingTemplateName) {
                this.loadingRenderer = fc.tpl.getRenderer(
                    this.loadingTemplateName
                );
            }

            if (!this.loadingRenderer) {
                this.loadingRenderer = function () {
                    return '加载中...';
                };
            }
        }
        return this.loadingRenderer;
    };

    overrides.enter = function () {
        var me = this;
        var state;
        if (!me.lifeStage.is(LifeStage.NEW | LifeStage.INITED)) {
            me.control.show();
            state = me.repaint();
        }
        else {
            state = me.render();
        }

        return state.then(function () {
            // 继续component的处理
            try {
                this.components = {};
                return require('fc-component-ria').init(me.container, {
                    model: me.model,
                    viewContext: me.viewContext,
                    components: me.components
                });
            }
            catch (ex) {
                var error = new Error(
                    'Component initialization error on Component '
                    + 'because: ' + ex.message
                );
                error.actualError = ex;
                throw error;
            }
        }).then(function () {
            // 环境内的ui被重置，所以要重新绑定事件
            me.initUIEvents();

            if (me.lifeStage.is(LifeStage.RENDERED)) {
                // 供外部来处理交互
                me.initBehavior();
            }

            // trigger一次resize
            // me.control.resize && me.control.resize();
        });
    };

    overrides.render = function () {
        // 初始化结构
        this.initStructure();

        var model = this.getModel();
        this.fire('loading');

        // 显示loading界面
        var loadingRenderer = this.getLoadingRenderer();
        this.control.setProperties({
            content: loadingRenderer(this.getTemplatedData())
        });

        var state = this.needToLoad ? model.load() : Promise.resolve(model);

        return state
            .then(_.bind(this.prepare, this))
            .then(_.bind(this.finishRender, this))
            .catch(_.bind(this.handleError, this));
    };

    overrides.components = {};

    /**
     * 根据id获取当前视图下的Component
     * @protected
     *
     * @param {string} id 控件的id
     * @return {?fcui.Control} 对应的控件
     */
    overrides.getComponent = function (id) {
        return this.components[id];
    };

    overrides.finishRender = function () {
        var me = this;
        me.fire('loaded');
        var renderer = me.getRenderer();

        if (renderer) {
            me.control.setProperties({
                content: renderer(me.getTemplatedData())
            });
        }

        // 请注意，生命周期的改变会自动fire同名事件
        me.lifeStage.changeTo(LifeStage.RENDERED);
    };

    overrides.repaint = function () {

        var me = this;
        var renderer = me.getRenderer();
        if (renderer) {
            me.control.setContent(renderer(me.getTemplatedData()));
        }

        me.control.repaint();

        // 请注意，生命周期的改变会自动fire同名事件
        me.lifeStage.changeTo(LifeStage.REPAINTED);

        return Promise.resolve();
    };

    overrides.initBehavior = function () {};

    /**
     * 给指定的控件绑定事件
     *
     * @param {BaseComponent} module BaseComponent对象实例
     * @param {string} id 控件的id
     * @param {string} eventName 事件名称
     * @param {Function | string} handler 事件处理函数，或者对应的方法名
     * @return {Function} 绑定到控件上的事件处理函数，不等于`handler`参数
     * @inner
     */
    function bindEventToControl(module, id, eventName, handler) {
        if (typeof handler === 'string') {
            handler = module[handler];
        }

        // TODO: mini-event后续会支持`false`作为处理函数，要考虑下
        if (typeof handler !== 'function') {
            return handler;
        }

        var control = module.get(id);
        if (control) {
            control.on(eventName, handler, module);
        }

        return handler;
    }

    /**
     * 给指定的控件组批量绑定事件，相同的处理
     *
     * @param {BaseComponent} module BaseComponent对象实例
     * @param {string} groupid 控件组的id
     * @param {string} eventName 事件名称
     * @param {function | string} handler 事件处理函数，或者对应的方法名
     * @inner
     */
    function bindEventToGroup(module, groupid, eventName, handler) {
        // 因为控件组这时候实际上已经生成了，后续修改也不会影响整个对象，所以直接使用它
        var group = module.getGroup(groupid);

        group.each(function (item) {
            bindEventToControl(module, item.id, eventName, handler);
        });
    }

    overrides.initUIEvents = function () {
        var me = this;
        var uiEvents = me.getUIEvents();

        if (!uiEvents) {
            return;
        }
        // 依次处理配置在uiEvents中的事件
        for (var key in uiEvents) {
            if (!uiEvents.hasOwnProperty(key)) {
                continue;
            }

            // 可以用`uiid:click`的形式在指定控件上绑定指定类型的事件
            // `@groupid:click`的形式批量绑定指定类型的事件另行处理
            var segments = key.split(':');
            if (segments.length > 1) {
                var id = segments[0];
                var type = segments[1];
                var handler = uiEvents[key];

                if (id.charAt(0) === '@') {
                    // group处理
                    bindEventToGroup(me, id.substring(1), type, handler);
                }
                else {
                    bindEventToControl(me, id, type, handler);
                }
            }
            // 也可以是一个控件的id，值是对象，里面每一项都是一个事件类型
            // 或者是`@groupid`的形式
            else {
                var map = uiEvents[key];
                fc.assert.equals(_.isObject(map), true, 'uiEvents必须是对象！');

                for (var gType in map) {
                    if (!map.hasOwnProperty(gType)) {
                        continue;
                    }
                    var gHandler = map[gType];
                    if (key.charAt(0) === '@') {
                        // group处理
                        bindEventToGroup(me, key.substring(1), gType, gHandler);
                    }
                    else {
                        bindEventToControl(me, key, gType, gHandler);
                    }
                }
            }
        }
    };

    overrides.refresh = function () {
        // 现在先为repaint罢
        this.enter();
    };

    overrides.show = function () {
        var me = this;

        me.enter().then(function () {
            me.fire('showed');
        }).catch(_.bind(me.handleError, me));
    };

    overrides.hide = function () {
        // 默认销毁
        this.close();
        // this.fire('hided');
    };

    overrides.close = function () {
        this.dispose();
    };

    overrides.dispose = function () {
        this.model = null;
        if (this.components) {
            for (var k in this.components) {
                if (this.components.hasOwnProperty(k)) {
                    this.components[k].dispose();
                }
            }
        }
        if (this.viewContext) {
            this.viewContext.dispose();
        }
        this.components = null;
        this.viewContext = null;
    };

    var BaseComponent = fc.oo.derive(EventTarget, overrides);

    return BaseComponent;
});
