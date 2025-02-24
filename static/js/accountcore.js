// alert('hello world123');
odoo.define('accountcore.accountcoreListRenderer', function (require) {
    "use strict";
    var ListRenderer = require('web.ListRenderer');

    ListRenderer.include({
        events: _.extend({}, ListRenderer.prototype.events, {
            'change table td.voucher_d_amount': '_entryamountChange',
            'change table td.voucher_c_amount': '_entryamountChange',
        }),
        _entryamountChange: function (event) {
            // var $event = $(event.currentTarget)
            // alert(event.target.value);
            // var newValue = event.target.value;
            // if (newValue - 0 == 0) {
            //     $event.css('background-color', 'red');
            //     // $event.parent().addClass('amount-zero');
            //     return;
            // }
            // $event.css('background-color', 'white');
            // // $event.parent().removeClass('amount-zero')
            // alert('hello world');
        },
        init: function (parent, state, params) {
            var self = this;
            this._super.apply(this, arguments);
        },
        _renderBodyCell: function (record, node, colIndex, options) {
            var self = this;
            var newTd = this._super.apply(this, arguments);

            var name = node.attrs.name;
            var amount = record.data[name];
            if (_hasClass(newTd, 'amountColor')) {
                _changeNodeColor(newTd, amount);
            };
            return newTd;
        }
    });
    //改变金额节点颜色
    function _changeNodeColor(node, amount) {
        switch (true) {
            case (amount - 0 > 0):
                break;
            case (amount - 0 == 0):
                node.addClass('amount-zero');
                break;
            case (amount - 0 < 0):
                node.addClass('amount-negative');
                break;
            default:
                break;
        }
        return node;
    };

    //含有类
    function _hasClass(td, className) {
        if (td.hasClass(className)) {
            return true;
        };
        return false;
    };
    return ListRenderer;
});
// alert('hello world end');

odoo.define('web.accountcoreExtend', ['web.relational_fields', 'accountcore.accountcoreVoucher', 'web.field_registry'], function (require) {
    "use strict";
    var relational_fields = require('web.relational_fields');
    var fieldMany2ManyTags = relational_fields.FieldMany2ManyTags;
    var accountcoreVoucher = require('accountcore.accountcoreVoucher');
    var tiger_accountItems_m2m = fieldMany2ManyTags.extend({

        activate: function () {
            return this.choiceItemsModel ? this.choiceItemsModel.activate() : false;
        },
        getFocusableElement: function () {
            return this.choiceItemsModel ? this.choiceItemsModel.getFocusableElement() : $();
        },

        /**
         * @private
         */
        _renderEdit: function () {
            var self = this;
            var newAccountId = 0;
            var preAccountId = 0;
            if (this.record.data.account && this.record.data.account.data.id) {
                newAccountId = this.record.data.account.data.id;
            };
            if (this.choiceItemsModel) {
                preAccountId = this.choiceItemsModel.ac_accountId;
                if (preAccountId == newAccountId) {
                    return;
                }
                this.choiceItemsModel.destroy();
            };
            this.choiceItemsModel = new accountcoreVoucher.choiceItemsModel(this, this.name, this.record, {
                mode: 'edit',
                noOpen: true,
                viewType: this.viewType,
                attrs: this.attrs,
            }, newAccountId);
            this.choiceItemsModel.value = false;
            return this.choiceItemsModel.appendTo(this.$el);
        },
        willStart: function () {
            return this._super.apply(this, arguments);
        },
        _onFieldChanged: function (ev) {
            if ($.inArray(ev.target, this.choiceItemsModel.ac_choiceItemsMany2ones) == -1) {
                return;
            };
            ev.stopPropagation();
            var newValue = ev.data.changes[this.name];
            if (newValue) {
                this._addTag(newValue);
                var id = ev.target.ac_itemId;
                if (id && id > 0 && id != newValue.id) {
                    this._removeTag(id);
                }
                ev.target.ac_itemId = newValue.id;
                ev.target.ac_itemName = newValue.display_name;
            };
            //重要覆写
            ev.stopPropagation();
        },

    });
    var fieldRegistry = require('web.field_registry');
    fieldRegistry.add('tiger_accountItems_m2m', tiger_accountItems_m2m);
    return {
        tiger_accountItems_m2m: tiger_accountItems_m2m
    };
});
odoo.define('accountcore.accountcoreVoucher', ['web.AbstractField', 'web.relational_fields', 'web.field_registry', 'web.core', 'web.field_utils'], function (require) {
    "use strict";
    var AbstractField = require('web.AbstractField');
    var relational_fields = require('web.relational_fields');
    var FieldMany2One = relational_fields.FieldMany2One;
    var core = require('web.core');
    var qweb = core.qweb;
    var field_utils = require('web.field_utils');
    var _t = core._t;
    var ChoiceItemsMany2one = FieldMany2One.extend({
        events: _.extend({}, FieldMany2One.prototype.events, {

            'keydown input': '_onKeydown',

        }),
        /**输入时按tab键,跳到下一个项目
         * @param  {} e
         */
        _onKeydown: function (e) {
            self = this;
            e.stopImmediatePropagation();
            switch (e.which) {
                case $.ui.keyCode.TAB:
                    $('.itemChoice').nextUntil('.o_input').first().focus();
                    break;
                default:
                    self._super.apply(self, arguments);
            }
        },
        init: function (parent, name, record, options, typeId, itemName, itemId) {
            this.ac_itemTypeId = typeId;
            this.ac_itemName = itemName;
            this.ac_itemId = itemId;
            // this.ac_valueItemId = itemId;
            this.ac_newItemName = itemName;
            this.ac_newItemId = itemId;
            this.ac_lastSetValueItemId = undefined;
            this._super.apply(this, arguments);
            if (itemName) {
                this.m2o_value = itemName;
            } else {
                this.m2o_value = "";
            };

        },
        start: function () {
            this._super.apply(this, arguments);

        },
        _formatValue: function (value) {

            if (this.ac_itemName) {
                return this.ac_itemName;
            };
            return "";

        },
        _search: function (search_val) {
            var self = this;
            var def = $.Deferred();
            this.orderer.add(def);
            var context = this.record.getContext(this.recordParams);
            var domain = this.record.getDomain(this.recordParams);
            _.extend(context, this.additionalContext);

            var blacklisted_ids = this._getSearchBlacklist();
            if (blacklisted_ids.length > 0) {
                // domain.push(['id', 'not in', blacklisted_ids]);

            }
            //使核算项目下拉列表只选择对应类别
            domain.push(['itemClass', '=', this.ac_itemTypeId]);
            this._rpc({
                    model: this.field.relation,
                    method: "name_search",
                    kwargs: {
                        name: search_val,
                        args: domain,
                        operator: "ilike",
                        limit: this.limit + 1,
                        context: context,
                    }
                })
                .then(function (result) {
                    var values = _.map(result, function (x) {
                        x[1] = self._getDisplayName(x[1]);
                        return {
                            label: _.str.escapeHTML(x[1].trim()) || data.noDisplayContent,
                            value: x[1],
                            name: x[1],
                            id: x[0],
                        };
                    });

                    // search more... if more results than limit
                    if (values.length > self.limit) {
                        values = values.slice(0, self.limit);
                        values.push({
                            label: _t("Search More..."),
                            action: function () {
                                self._rpc({
                                        model: self.field.relation,
                                        method: 'name_search',
                                        kwargs: {
                                            name: search_val,
                                            args: domain,
                                            operator: "ilike",
                                            limit: 160,
                                            context: context,
                                        },
                                    })
                                    .then(self._searchCreatePopup.bind(self, "search"));
                            },
                            classname: 'o_m2o_dropdown_option',
                        });
                    }
                    var create_enabled = self.can_create && !self.nodeOptions.no_create;
                    // quick create
                    var raw_result = _.map(result, function (x) {
                        return x[1];
                    });
                    if (create_enabled && !self.nodeOptions.no_quick_create &&
                        search_val.length > 0 && !_.contains(raw_result, search_val)) {
                        values.push({
                            label: _.str.sprintf(_t('Create "<strong>%s</strong>"'),
                                $('<span />').text(search_val).html()),
                            action: self._quickCreate.bind(self, search_val),
                            classname: 'o_m2o_dropdown_option'
                        });
                    }
                    // create and edit ...
                    if (create_enabled && !self.nodeOptions.no_create_edit) {
                        var createAndEditAction = function () {
                            // Clear the value in case the user clicks on discard
                            self.$('input').val('');
                            return self._searchCreatePopup("form", false, self._createContext(search_val));
                        };
                        values.push({
                            label: _t("Create and Edit..."),
                            action: createAndEditAction,
                            classname: 'o_m2o_dropdown_option',
                        });
                    } else if (values.length === 0) {
                        values.push({
                            label: _t("No results to show..."),
                        });
                    }

                    def.resolve(values);
                });

            return def;
        },

        _onFieldChanged: function (event) {
            var newItem = event.data.changes.items;
            this.ac_newItemName = newItem.display_name;
            this.ac_newItemId = newItem.id;
            this.$input.val(this.ac_newItemName);
        },

    });
    var choiceItemsModel = AbstractField.extend({
        //凭证中的选择核算项目
        supportedFieldTypes: ['many2many'],
        template: 'accountcore_voucher_choice_items',

        custom_events: _.extend({}, AbstractField.prototype.custom_events, {

        }),
        events: _.extend({}, AbstractField.prototype.events, {

        }),

        init: function (parent, name, record, options, accountId) {
            this._super.apply(this, arguments);
            this.limit = 8;
            this.ac_items = []; //分录已有的核算项目
            this.ac_accountId = accountId;
            this.ac_choiceItemsMany2ones = [];
        },


        /**
         * 加载和设置分录核算项目
         * @returns {Deferred}
         */
        _initItems: function () {
            var self = this;
            return $.when(this._getEntryItems()).then(function (items) {
                self.ac_items = items;
            });
        },
        start: function () {
            var self = this;
            self.itemChoiceContainer = this.$el;
            return this._super.apply(this, arguments);

        },

        reinitialize: function (value) {
            this.isDirty = false;
            this.floating = false;
            return this._setValue(value);
        },
        /**获得对应核算项目类别的核算项目
         * @return {string} 项目名称
         */
        _getItem: function (items, typeId) {
            var item = {};
            $.each(items, function (i, n) {
                if (items[i].itemClass == typeId) {
                    item.name = items[i].name;
                    item.id = items[i].id;
                    return false;
                };
            });
            return item;
        },
        /**核算项目栏插入一个many2one部件
         * @param  {object} itemType 核算项目对象
         * @param  {object} container 凭证分录中的核算项目栏
         */
        _insertItemChoice: function (itemType, container) {
            var self = this;
            var typeName = itemType.name;
            var typeId = 'itemType_' + itemType.id;
            var attrs = this.attrs;
            // var items;

            var item = self._getItem(self.ac_items, itemType.id);

            var oneItemChoice = new ChoiceItemsMany2one(self, self.name, self.record, {
                mode: 'edit',
                noOpen: true,
                viewType: self.viewType,
                attrs: attrs,
            }, itemType.id, item.name, item.id);

            var itemsIds = $.map(self.ac_items, function (i) {
                return i.id;
            });
            oneItemChoice._getSearchBlacklist = function () {
                return itemsIds || [];
            };
            var itemRow = $(self._createItemChoiceHtml(typeName));
            itemRow.appendTo(container);
            var seletiontag = itemRow.find('.ac-item-selection').first();
            oneItemChoice.appendTo(seletiontag);
            self.ac_choiceItemsMany2ones.push(oneItemChoice);
            oneItemChoice.$el.find('input').attr('id', typeId);
        },
        /**获取科目下挂的核算项目类别
         * @param  {integer} accountId 科目ID
         * @returns {object} 核算项目类别列表[{'id':,'name':}]
         */
        _getItemTypes: function (accountId) {
            return this._rpc({
                model: 'accountcore.account',
                method: 'get_itemClasses',
                args: [accountId]
            });

        },
        /**构建核算项目类别标签
         * @param  {string} itemTypeName 核算项目类别名称
         */
        _createItemChoiceHtml: function (itemTypeName) {
            var htmlstr = "<div class='row itemChoice'><div class='col-3 ac-item-type-name'>" + itemTypeName + "</div><div class='ac-item-selection'></div></div>";
            return htmlstr;
        },
        _removeTag: function (id) {
            var record = _.findWhere(this.value.data, {
                res_id: id
            });
            this._setValue({
                operation: 'FORGET',
                ids: [record.id],
            });
        },
        _renderEdit: function () {
            var self = this;
            $.each(self.itemTypes, function (i) {
                self._insertItemChoice(self.itemTypes[i], self.itemChoiceContainer);
            });
        },
        willStart: function () {
            var self = this;
            var def1 = self._super.apply(this, arguments);
            var def2 = self._getItemTypes(self.record.data.account.res_id);
            var def3 = def2.then(function (param) {
                self.itemTypes = param;
            });
            var def4 = self._initItems();
            return $.when(def1, def2, def3, def4);
        },
        _getRenderTagsContext: function () {
            return {
                itemTypes: this.itemTypes,
            };
        },
        /**获得分录的核算项目列表
         * @param  {integer} entryId 分录ID
         * @return {obj} 核算项目列表{id:,name:,itemClass:}
         */
        _getEntryItems: function () {
            var entryId = this.record.data.items.res_ids;
            return this._rpc({
                model: 'accountcore.item',
                method: 'getEntryItems',
                args: [entryId]
            });
        },
        getFocusableElement: function () {
            return this.mode === 'edit' && this.$('input').first() || this.$el;
        },
    });
    var fieldRegistry = require('web.field_registry');
    fieldRegistry.add('choiceItemsModel', choiceItemsModel);
    return {
        ChoiceItemsMany2one: ChoiceItemsMany2one,
        choiceItemsModel: choiceItemsModel,

    }
});

//给凭证列表视图添加按钮
odoo.define('accountcore.accountcoreVoucheListButton', function (require) {
    "use strict";
    var ListView = require('web.ListView');
    var viewRegistry = require('web.view_registry');
    var ListController = require('web.ListController');
    var voucherListController = ListController.extend({
        renderButtons: function () {
            this._super.apply(this, arguments);
            if (this.$buttons) {
                var btn = this.$buttons.find('.ac_voucher_number_sort'); //凭证编号排序按钮
                btn.on('click', this.proxy('vouchersSortByNumber'));
            };
        },
        /**依据凭证编号对凭证列表进行排序
         */
        vouchersSortByNumber: function () {
            var tbody = this.$el.find('tbody').first();
            var trs = this.$el.find('tr.o_data_row');
            trs.detach();
            trs.sort(this._voucherNumbersort);
            tbody.append(trs);

        },
        _voucherNumbersort: function (a, b) {
            return $(a).find('.voucherNumber').text() - $(b).find('.voucherNumber').text();
        }

    });
    var voucherListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: voucherListController,
        }),
    });
    viewRegistry.add('voucherListView', voucherListView);
    return voucherListView;
});